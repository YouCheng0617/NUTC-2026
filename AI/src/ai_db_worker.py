import os
import psycopg2
import time
import re
from dotenv import load_dotenv
from main import LocalStickyNoteAI  # 匯入你強大的 AI 引擎

# --- 1. 強制尋找 .env 檔案的無敵寫法 ---
# 這會自動找到上一層 (也就是 AI 資料夾) 裡面的 .env，不管你在哪裡執行都不會出錯
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(env_path)

# --- 2. 密碼抓漏偵探 ---
print("=========================================")
print("💡 [偵錯] 系統抓到的 HOST 是：", os.getenv("DB_HOST"))
print("💡 [偵錯] 系統抓到的 密碼 是：", os.getenv("DB_PASSWORD"))
print("=========================================")

class AIDBWorker:
    def __init__(self):
        # 這裡會優先使用 .env 的設定，如果抓不到，HOST 會自動預設為 127.0.0.1 (避開 IPv6 問題)
        self.db_params = {
            "host": os.getenv("DB_HOST", "127.0.0.1"), 
            "user": os.getenv("DB_USER", "postgres"),
            "password": os.getenv("DB_PASSWORD"),
            "database": os.getenv("DB_NAME", "driftBottle"),
            "port": os.getenv("DB_PORT", "5432")
        }
        # 初始化你在 main.py 寫好的 AI 引擎
        self.ai_engine = LocalStickyNoteAI()

    def check_content(self, text):
        # --- 第一層：硬核黑名單 ---
        bad_words = [
            '砸', '球棒', '打人', '堵人', '報仇', '弄死', '笨蛋', '醜', 
            '腦殘', '白痴', '智障', '噁心', '廢物', '垃圾', '加賴', 'LINE'
        ]
        for word in bad_words:
            if word in text:
                return "不通過", f"偵測到違規關鍵字：{word}", "未分類"

        # --- 第二層：正規表達式 ---
        phone_pattern = r"09\d{2}[-?\s]?\d{3}[-?\s]?\d{3}"
        if re.search(phone_pattern, text):
            return "不通過", "偵測到敏感聯絡資訊 (電話)", "未分類"

        # --- 第三層：極簡 AI 語意審核 ---
        try:
            print(f"🤖 AI 深度審核與分類中...")
            review_result = self.ai_engine.check_content(text)
            
            # 安全檢查：確保 review_result 是字典格式
            if isinstance(review_result, dict):
                status = review_result.get("ai_status", "通過")
                reason = review_result.get("ai_reason", "無")
            else:
                status, reason = "通過", "AI 回傳格式異常"
            
            category = self.ai_engine.get_category(text)
            return status, reason, category
        except Exception as e:
            # 如果 AI 服務斷線或報錯，為了不讓程式掛掉，先預設通過
            return "通過", f"AI 暫時無法連線: {str(e)}", "未分類"

    def run(self):
        try:
            conn = psycopg2.connect(**self.db_params)
            cur = conn.cursor()
            print(f"🚀 [AI 整合版] 守門員啟動！連線成功，監聽資料庫中...")

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
                    
                    # 更新資料庫 (包含分類)
                    cur.execute(
                        'UPDATE "posts" SET ai_status = %s, ai_reason = %s, category = %s WHERE id = %s',
                        (status, reason, category, post_id)
                    )
                    conn.commit()
                    print(f"✅ ID {post_id} -> {status} | 分類: {category} ({reason})")

                time.sleep(2)
        except Exception as e:
            print(f"❌ 錯誤: {e}")
        finally:
            if 'conn' in locals():
                conn.close()

if __name__ == "__main__":
    worker = AIDBWorker()
    worker.run()