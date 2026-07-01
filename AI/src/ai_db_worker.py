import os
import psycopg2
import time
import re
import requests
from dotenv import load_dotenv
from main import LocalStickyNoteAI

# --- 1. 環境變數加載與安全檢查 ---
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(env_path)

WEBHOOK_URL = os.getenv("BACKEND_URL")
API_KEY = os.getenv("AI_WEBHOOK_API_KEY")

if not WEBHOOK_URL:
    print("⚠️ 警告：環境變數缺少 BACKEND_URL")
if not API_KEY:
    print("⚠️ 警告：環境變數缺少 AI_WEBHOOK_API_KEY")

class AIDBWorker:
    def __init__(self):
        # 💡 終極修正：直接使用 Prisma 的連線字串，確保跟前端連到同一個宇宙！
        self.db_url = os.getenv("DATABASE_URL")
        
        if not self.db_url:
            print("⚠️ 致命警告：.env 裡面找不到 DATABASE_URL，請確認設定！")
            
        self.ai_engine = LocalStickyNoteAI()
        self.phone_regex = re.compile(r"09\d{2}[-?\s]?\d{3}[-?\s]?\d{3}")

    # ... (中間的 send_webhook 和 check_content 保持不變) ...

    def run(self):
        """背景監聽資料庫迴圈"""
        while True:
            conn = None
            try:
                # 💡 終極修正：直接用這串 URL 連線
                conn = psycopg2.connect(self.db_url)
                conn.autocommit = True  
                cur = conn.cursor()
                print(f"🚀 [背景審核工人] 啟動成功！連線資料庫並監聽中...")
                
                # --- 🕵️‍♀️ 偵錯小雷達 ---
                cur.execute('SELECT bottle_id, status FROM "Bottle" LIMIT 1')
                test_row = cur.fetchone()
                if test_row:
                    print(f"👀 [偵錯雷達] 找到文章了！ID: {test_row[0]}, 狀態是: {test_row[1]}")
                else:
                    print("⚠️ [偵錯雷達] 警告：資料表還是空的，請確認 DATABASE_URL 是否正確！")
                # ----------------------------------------

                while True:
                    # 抓取 status = 1 的文章
                    cur.execute('SELECT bottle_id, content FROM "Bottle" WHERE status = 1')
                    rows = cur.fetchall()

                    if not rows:
                        time.sleep(3)
                        continue

                    for row in rows:
                        post_id, content = row
                        print(f"🔍 檢查 ID {post_id}...")
                        
                        # 交給 AI 審核 (回傳文字狀態、原因、分類代號)
                        ai_status_str, reason, category = self.check_content(content)
                        
                        # 將中文狀態轉換為數字代號存入資料庫
                        db_status_code = 2 if ai_status_str == "通過" else 3
                        
                        # 對齊 Prisma 欄位名稱 (status, violation_reason)
                        cur.execute(
                            'UPDATE "Bottle" SET status = %s, violation_reason = %s WHERE bottle_id = %s',
                            (db_status_code, reason, post_id)
                        )

                        # 呼叫 Webhook
                        self.send_webhook(post_id, ai_status_str, reason)
                        print(f"✅ ID {post_id} 處理完成 -> 狀態改為: {db_status_code} ({ai_status_str})")

                    time.sleep(2)

            except psycopg2.OperationalError as e:
                print(f"❌ 資料庫連線中斷，請檢查 DATABASE_URL: {e}")
                time.sleep(5)
            except Exception as e:
                print(f"❌ 嚴重錯誤: {e}")
                time.sleep(5)
            finally:
                if conn is not None:
                    conn.close()
# === 底部乾淨的啟動區塊 ===
if __name__ == "__main__":
    try:
        worker = AIDBWorker()
        worker.run()
    except KeyboardInterrupt:
        print("\n👋 系統管理員手動關閉背景審核工人。")