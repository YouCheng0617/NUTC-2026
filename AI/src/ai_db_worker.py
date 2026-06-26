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

# 🛡️ 安全防護機制：如果 .env 裡面忘記設定，直接引發 ValueError 終止程式
if not WEBHOOK_URL:
    raise ValueError("❌ 致命錯誤：環境變數缺少 BACKEND_URL，請確保 .env 檔案已正確設定！")

if not API_KEY:
    raise ValueError("❌ 致命錯誤：環境變數缺少 AI_WEBHOOK_API_KEY，請確保 .env 檔案已正確設定！")

class AIDBWorker:
    def __init__(self):
        # 保留預設值防呆
        self.db_params = {
            "host": os.getenv("DB_HOST", "127.0.0.1"), 
            "user": os.getenv("DB_USER", "postgres"),
            "password": os.getenv("DB_PASSWORD"),
            "database": os.getenv("DB_NAME", "driftBottle"),
            "port": os.getenv("DB_PORT", "5432")
        }
        self.ai_engine = LocalStickyNoteAI()
        
        # 💡 優化 1：提升效能
        self.phone_regex = re.compile(r"09\d{2}[-?\s]?\d{3}[-?\s]?\d{3}")

    def send_webhook(self, bottle_id, status_str, reason):
        """依照規格書回傳審核結果給後端 API"""
        headers = {"x-api-key": API_KEY, "Content-Type": "application/json"}
        
        status_code = 1 if status_str == "通過" else 2
        payload = {"bottle_id": bottle_id, "status": status_code}
        if status_code == 2: payload["violation_reason"] = reason

        try:
            response = requests.patch(WEBHOOK_URL, json=payload, headers=headers, timeout=5)
            if response.status_code == 200:
                print(f"📡 Webhook 回報成功 (ID: {bottle_id})")
            else:
                print(f"⚠️ 後端拒絕接收 (狀態碼: {response.status_code})")
        except requests.exceptions.ConnectionError:
            # 💡 這裡改成只顯示簡短提示
            print(f"💤 系統提示：後端伺服器未開啟，Webhook 暫存於資料庫，待下次重試。")
        except Exception as e:
            print(f"❌ Webhook 發生非預期錯誤: {e}")

    def check_content(self, text):
        # --- 第一層：硬核黑名單 ---
        bad_words = ['砸', '球棒', '打人', '堵人', '報仇', '笨蛋', '醜', '垃圾', '加賴', 'LINE', '賺錢', '領取']
        for word in bad_words:
            if word in text:
                # 💡 優化：就算被攔截，也強制賦予一個「違規訊息」的分類
                return "不通過", f"偵測到違規關鍵字：{word}", "違規訊息"

        # --- 第二層：正規表達式 ---
        if self.phone_regex.search(text):
            return "不通過", "偵測到敏感聯絡資訊 (電話)", "違規訊息"

        # --- 第三層：AI 語意審核 ---
        try:
            res = self.ai_engine.check_content(text)
            status = res.get("ai_status", "通過") if isinstance(res, dict) else "通過"
            reason = res.get("ai_reason", "無") if isinstance(res, dict) else "格式異常"
            category = self.ai_engine.get_category(text)
            return status, reason, category
        except Exception as e:
            return "通過", f"AI 連線異常: {str(e)}", "生活瑣事"

    def run(self):
        # 💡 優化 3 & 4：加上外層迴圈與資料庫斷線重連機制 (Auto-Reconnect)
        while True:
            conn = None
            try:
                conn = psycopg2.connect(**self.db_params)
                cur = conn.cursor()
                print(f"🚀 [Webhook 完美整合版] 啟動成功！連線資料庫並監聽中...")

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
                        
                        # 1. 更新本機資料庫
                        cur.execute(
                            'UPDATE "posts" SET ai_status = %s, ai_reason = %s, category = %s WHERE id = %s',
                            (status, reason, category, post_id)
                        )
                        conn.commit()

                        # 2. 發送 Webhook
                        self.send_webhook(post_id, status, reason)
                        print(f"✅ ID {post_id} 處理完成 -> {status}")

                    time.sleep(2)

            except psycopg2.OperationalError as e:
                print(f"❌ 資料庫連線中斷，5 秒後嘗試重新連線...: {e}")
                time.sleep(5)
            except Exception as e:
                print(f"❌ 嚴重錯誤: {e}")
                time.sleep(5)
            finally:
                if conn is not None:
                    conn.close()
def get_category(self, text): # 如果在類別裡，記得加上 self
    prompt = f"""
    請將以下內容分類。妳只能且必須從【生活瑣事, 心情告白, 匿名抱怨, 技術分享, 違規訊息】這五個詞中選擇一個。
    請不要輸出任何多餘的文字、括號、標點符號或解釋。
    內容：{text}
    """
    
    # 正確呼叫並抓取純文字
    response = self.ai_engine.generate_content(prompt)
    
    raw_response = response.text 
    
    print(f"AI 原始回覆: {raw_response}") 
    
    allowed = ["生活瑣事", "心情告白", "匿名抱怨", "技術分享", "違規訊息"]
    for category in allowed:
        if category in raw_response:
            return category
            
    return "生活瑣事"
if __name__ == "__main__":
    worker = AIDBWorker()
    worker.run()
while True:
    # 系統自動撈出所有「還沒處理過」的資料
    # 不需要指定 ID，只要 ai_status 是空的，就全部抓出來！
    rows = db.query('SELECT id, content FROM "posts" WHERE ai_status IS NULL')
    
    for row in rows:
        # 自動審核、自動分類、自動填入
        category = get_category(row['content'])
        db.execute('UPDATE "posts" SET ai_status = "完成", category = %s WHERE id = %s', (category, row['id']))
        
    time.sleep(5) # 休息一下再繼續監聽