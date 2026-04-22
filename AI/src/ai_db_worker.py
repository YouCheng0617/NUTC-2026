import os
import psycopg2
import time
import re
import requests  # 新增：用於發送 Webhook 請求
from dotenv import load_dotenv
from main import LocalStickyNoteAI

# --- 1. 環境變數加載 ---
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(env_path)

# 密鑰與後端網址 (從 .env 讀取，若讀不到則使用預設值)
WEBHOOK_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:3001/bottles/review")
API_KEY = os.getenv("AI_WEBHOOK_API_KEY", "jiwgoihiwrhgodag)3699822{jgijape'aejgipw'*APILOL*@5year}")

class AIDBWorker:
    def __init__(self):
        self.db_params = {
            "host": os.getenv("DB_HOST", "127.0.0.1"), 
            "user": os.getenv("DB_USER", "postgres"),
            "password": os.getenv("DB_PASSWORD"),
            "database": os.getenv("DB_NAME", "driftBottle"),
            "port": os.getenv("DB_PORT", "5432")
        }
        self.ai_engine = LocalStickyNoteAI()

    def send_webhook(self, bottle_id, status_str, reason):
        """
        依照規格書回傳審核結果給後端
        - status 1: 通過
        - status 2: 違規
        """
        headers = {
            "x-api-key": API_KEY,
            "Content-Type": "application/json"
        }
        
        # 轉換狀態碼：通過 -> 1, 不通過 -> 2
        status_code = 1 if status_str == "通過" else 2
        
        payload = {
            "bottle_id": bottle_id,
            "status": status_code
        }
        
        # 只有在違規時才帶上理由
        if status_code == 2:
            payload["violation_reason"] = reason

        try:
            # 規格書要求使用 PATCH
            response = requests.patch(WEBHOOK_URL, json=payload, headers=headers)
            if response.status_code == 200:
                print(f"📡 Webhook 回報成功 (ID: {bottle_id})")
            else:
                print(f"⚠️ Webhook 失敗 (狀態碼: {response.status_code}): {response.text}")
        except Exception as e:
            print(f"❌ Webhook 連線發生異常: {e}")

    def check_content(self, text):
        # --- 第一層：硬核黑名單 ---
        bad_words = ['砸', '球棒', '打人', '堵人', '報仇', '笨蛋', '醜', '垃圾', '加賴', 'LINE']
        for word in bad_words:
            if word in text:
                return "不通過", f"偵測到違規關鍵字：{word}", "未分類"

        # --- 第二層：正規表達式 ---
        if re.search(r"09\d{2}[-?\s]?\d{3}[-?\s]?\d{3}", text):
            return "不通過", "偵測到敏感聯絡資訊 (電話)", "未分類"

        # --- 第三層：AI 語意審核 ---
        try:
            print(f"🤖 AI 深度審核中...")
            res = self.ai_engine.check_content(text)
            status = res.get("ai_status", "通過") if isinstance(res, dict) else "通過"
            reason = res.get("ai_reason", "無") if isinstance(res, dict) else "格式異常"
            category = self.ai_engine.get_category(text)
            return status, reason, category
        except Exception as e:
            return "通過", f"AI 連線異常: {str(e)}", "未分類"

    def run(self):
        try:
            conn = psycopg2.connect(**self.db_params)
            cur = conn.cursor()
            print(f"🚀 [Webhook 整合版] 啟動成功！連線資料庫並監聽中...")

            while True:
                cur.execute('SELECT id, content FROM "posts" WHERE ai_status IS NULL')
                rows = cur.fetchall()

                if not rows:
                    time.sleep(3)
                    continue

                for row in rows:
                    post_id, content = row
                    print(f"🔍 檢查 ID {post_id}...")
                    
                    status, reason, category = self.check_content(content)
                    
                    # 1. 更新本機資料庫標記已處理 (加上處理結果)
                    cur.execute(
                        'UPDATE "posts" SET ai_status = %s, ai_reason = %s, category = %s WHERE id = %s',
                        (status, reason, category, post_id)
                    )
                    conn.commit()

                    # 2. 發送 Webhook 給組員的後端系統
                    self.send_webhook(post_id, status, reason)
                    
                    print(f"✅ ID {post_id} 處理完成 -> {status}")

                time.sleep(2)
        except Exception as e:
            print(f"❌ 嚴重錯誤: {e}")
        finally:
            if 'conn' in locals(): conn.close()

if __name__ == "__main__":
    worker = AIDBWorker()
    worker.run()