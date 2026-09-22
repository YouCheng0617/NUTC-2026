import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import type { Request, Response, NextFunction } from "express";

// 圖片存放位置：與 index.ts 的 /uploads 靜態路由同源 (VM: /home/youcheng/NUTC-2026/backend/uploads/customer-service)
export const CS_UPLOAD_DIR = path.join(process.cwd(), "uploads", "customer-service");
const CS_URL_PREFIX = "/uploads/customer-service";

export const CS_MAX_IMAGES = 3;
export const CS_MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 單張 5MB

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// 先放記憶體，驗證檔頭通過後才寫入硬碟，避免殘留不合法檔案
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: CS_MAX_IMAGE_SIZE, files: CS_MAX_IMAGES },
    fileFilter: (req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
            return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
        }
        cb(null, true);
    }
}).array("images", CS_MAX_IMAGES);

const MULTER_ERROR_MESSAGES: Record<string, string> = {
    LIMIT_FILE_SIZE: `單張圖片不可超過 ${CS_MAX_IMAGE_SIZE / 1024 / 1024}MB`,
    LIMIT_FILE_COUNT: `最多只能上傳 ${CS_MAX_IMAGES} 張圖片`,
    LIMIT_UNEXPECTED_FILE: `僅接受 jpg、png、webp 格式，且最多 ${CS_MAX_IMAGES} 張 (欄位名稱: images)`
};

// 包裝 multer，把錯誤轉成 400 回應
export function csImageUpload(req: Request, res: Response, next: NextFunction) {
    upload(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ message: MULTER_ERROR_MESSAGES[err.code] ?? "圖片上傳失敗" });
        }
        if (err) {
            console.error("客服圖片上傳時發生錯誤:", err);
            return res.status(500).json({ message: "圖片上傳失敗" });
        }
        next();
    });
}

// 依檔頭 (magic bytes) 判斷真實格式，不信任前端給的副檔名/mimetype
function detectImageExt(buf: Buffer): string | null {
    if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return ".jpg";
    if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return ".webp";
    if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return ".webp";
    return null;
}

// 驗證並寫入硬碟，回傳要存進資料庫的路徑；任一張不合法則整批不寫入並回傳 null
export async function saveCSImages(files: Express.Multer.File[]): Promise<string[] | null> {
    const exts = files.map(f => detectImageExt(f.buffer));
    if (exts.some(ext => ext === null)) return null;

    await fs.mkdir(CS_UPLOAD_DIR, { recursive: true });

    const urls: string[] = [];
    try {
        for (const [i, file] of files.entries()) {
            const fileName = `${randomUUID()}${exts[i]}`;
            await fs.writeFile(path.join(CS_UPLOAD_DIR, fileName), file.buffer);
            urls.push(`${CS_URL_PREFIX}/${fileName}`);
        }
    } catch (error) {
        await deleteCSImages(urls);
        throw error;
    }
    return urls;
}

// 刪除客服圖片 (只處理 customer-service 資料夾內的檔案)
export async function deleteCSImages(urls: string[]) {
    await Promise.all(urls.map(async (url) => {
        if (!url.startsWith(`${CS_URL_PREFIX}/`)) return;
        const filePath = path.join(CS_UPLOAD_DIR, path.basename(url));
        try {
            await fs.unlink(filePath);
        } catch (error: any) {
            if (error?.code !== "ENOENT") console.error("刪除客服圖片失敗:", filePath, error);
        }
    }));
}
