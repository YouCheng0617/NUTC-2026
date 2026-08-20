import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prisma from './prisma.js';
import 'dotenv/config';

// 取得當前檔案與目錄路徑
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 預設圖片來源資料夾 (backend/uploads)
const DEFAULT_UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

// 支援的圖片副檔名 (僅讀取 .webp)
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.webp']);

/**
 * 遞迴讀取資料夾內的所有圖片路徑
 * @param dir 目標資料夾路徑
 * @returns 圖片檔案的相對路徑清單 (例如: ['/uploads/pic1.png', '/uploads/sub/pic2.jpg'])
 */
export async function scanImageFiles(dir: string = DEFAULT_UPLOADS_DIR): Promise<string[]> {
  const imagePaths: string[] = [];

  // 若資料夾不存在則自動建立
  try {
    await fs.access(dir);
  } catch {
    console.warn(`[pictureHelper] 目標資料夾不存在，自動建立: ${dir}`);
    await fs.mkdir(dir, { recursive: true });
    return [];
  }

  async function walk(currentPath: string) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
          // 計算相對於 uploads 的路徑，並統一轉換為 URL 路徑格式 (/uploads/...)
          const relativePath = path.relative(DEFAULT_UPLOADS_DIR, fullPath).replace(/\\/g, '/');
          imagePaths.push(`/uploads/${relativePath}`);
        }
      }
    }
  }

  await walk(dir);
  return imagePaths;
}

/**
 * 讀取圖片並自動同步建立圖片圖鑑資料 (Picture) 到資料庫
 * @param targetDir 指定資料夾（選填，預設為 uploads）
 */
export async function syncPicturesToDatabase(targetDir: string = DEFAULT_UPLOADS_DIR) {
  try {
    console.log(`🔍 開始掃描圖片目錄: ${targetDir}`);
    const images = await scanImageFiles(targetDir);

    if (images.length === 0) {
      console.log('ℹ️ 未找到任何圖片檔案。');
      return { total: 0, images: [] };
    }

    console.log(`📸 找到 ${images.length} 張圖片，準備同步至 Picture 圖鑑資料表...`);

    let createdCount = 0;
    for (const imageUrl of images) {
      const baseName = path.basename(imageUrl, path.extname(imageUrl));
      const formattedTitle = baseName.replace(/[-_]/g, ' ');

      // 判斷稀有度：路徑包含 fishPro 為高級 (PREMIUM)，包含 fish 為普通 (NORMAL)
      let rarity: 'NORMAL' | 'PREMIUM' = 'NORMAL';
      if (imageUrl.includes('/fishPro/') || /(fishpro|rare|premium|高級|稀有)/i.test(imageUrl)) {
        rarity = 'PREMIUM';
      } else if (imageUrl.includes('/fish/')) {
        rarity = 'NORMAL';
      }

      // 判斷主題系列
      let category = '海洋生物';
      if (imageUrl.includes('marine-creatures')) {
        category = '海洋生物';
      }

      // 任務條件說明
      const taskRequirement = rarity === 'PREMIUM' 
        ? '完成高級海洋探索任務或特殊成就獲得' 
        : '完成每日海洋任務或基礎活動獲得';

      // 使用 upsert 避免重複插入相同路徑的圖片
      await prisma.picture.upsert({
        where: { image_url: imageUrl },
        update: {
          rarity,
          category,
          task_requirement: taskRequirement,
          total_pieces: 9
        },
        create: {
          title: formattedTitle || '未命名生物',
          description: `${rarity === 'PREMIUM' ? '【稀有】' : ''}探索海洋所獲得的 ${formattedTitle} 拼圖！`,
          image_url: imageUrl,
          total_pieces: 9, // 預設 9 片碎片 (1~9)
          rarity: rarity, // NORMAL: 普通, PREMIUM: 高級
          category: category,
          task_requirement: taskRequirement,
          is_active: true
        }
      });
      createdCount++;
    }

    console.log(`✅ 成功同步 ${createdCount} 筆圖鑑資料！`);
    return {
      total: images.length,
      images
    };
  } catch (error) {
    console.error('❌ 寫入圖片至資料庫時發生錯誤:', error);
    throw error;
  }
}

// 支援直接透過終端機執行 (例如: npx tsx src/lib/pictureHelper.ts)
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  syncPicturesToDatabase()
    .then((result) => {
      console.log(`🎉 處理完成！共計 ${result?.total ?? 0} 張圖片。`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
