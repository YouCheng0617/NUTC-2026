import os
import psycopg2
import ollama
import json
import time
import re
from dotenv import load_dotenv

# 加載資料庫設定
load_dotenv()

class AIDBWorker:
    def __init__(self):
        self.db_params = {
            "host": os.getenv("DB_HOST", "localhost"),
            "user": os.getenv("DB_USER", "postgres"),
            "password": os.getenv("DB_PASSWORD"),
            "database": os.getenv("DB_NAME", "driftBottle"),
            "port": os.getenv("DB_PORT", "5432")
        }
        self.model_name = "llama3.2:1b"

    def check_content(self, text):
        """
        三重防禦機制：
        1. 硬核黑名單（物理攔截）
        2. 正規表達式（隱私攔截：電話、地址）
        3. 極簡 AI 語意（邏輯攔截）
        """
        
        # --- 第一層：擴充版黑名單 ---
        bad_words = [
            '砸', '球棒', '打人', '堵人', '報仇', '弄死', '小心點', '好看', '後果', # 暴力行為
            '笨蛋', '醜', '沒救', '討厭', '腦殘', '白痴', '智障', '噁心', '廢物', '垃圾', # 辱罵
            '中獎', '領取', '現領', '賺錢', '兼職', '點擊', 'http', 'https', '.com', # 詐騙廣告
            '加賴', '加我', '私訊', '我的ID', 'LINE', 'WeChat' # 誘導私下聯繫
        ]
        
        for word in bad_words:
            if word in text:
                return "不通過", f"偵測到違規關鍵字：{word}"

        # --- 第二層：正規表達式 (Regex) ---
        # 1. 電話號碼 (支援多種格式)
        phone_pattern = r"09\d{2}[-?\s]?\d{3}[-?\s]?\d{3}"
        if re.search(phone_pattern, text):
            return "不通過", "偵測到敏感聯絡資訊 (電話)"
            
        # 2. 地址特徵 (抓取包含 市/區/路/街/號 的組合)
        address_pattern = r"(.+[市縣])?(.+[區市鎮鄉])?(.+[路街巷弄])?(\d+號)?"
        # 針對 ID 12 的特別加強：如果內容包含常見地址字眼
        if any(keyword in text for keyword in ['市', '區', '路', '街', '巷', '弄', '號']):
            # 判斷是否看起來像地址（簡單邏輯：字數較長且包含多個地址單位）
            address_count = sum(1 for k in ['市', '區', '路', '街', '巷'] if k in text)
            if address_count >= 2:
                return "不通過", "偵測到疑似個人住址資訊"

        # --- 第三層：極簡 AI 語意審核 ---
        # 為了防止 1b 模型亂講話，我們把 Prompt 縮到最短
        prompt = f"""
        你是審核員。分析這段話是否有「惡意威脅」或「欺騙」：
        "{text}"
        
        規則：
        - 有惡意、威脅、或要求私下聯絡，回傳 s:"不通過"
        - 正常內容，回傳 s:"通過"
        
        輸出格式：{{"s": "結果", "r": "原因"}}
        """
        
        try:
            # ... 原有的 ollama.chat ...
            data = json.loads(response['message']['content'])
            
            # 更加嚴格的取值邏輯
            status = data.get('s')
            reason = data.get('r', '無')
            
            # 如果 AI 回傳的 status 不是我們想要的，強制修正
            if status not in ["通過", "不通過"]:
                status = "通過" # 正常內容若 AI 亂回，預設放行
                
            return status, reason
        except:
            # 發生任何解析錯誤（像 ID 4 這種狀況），預設為通過
            return "通過", "無"
    def run(self):
        try:
            conn = psycopg2.connect(**self.db_params)
            cur = conn.cursor()
            print(f"🚀 [版本 2.0] AI 守門員啟動！監聽中...")

            while True:
                cur.execute('SELECT id, content FROM "posts" WHERE ai_status IS NULL')
                rows = cur.fetchall()

                if not rows:
                    time.sleep(3)
                    continue

                for row in rows:
                    post_id, content = row
                    print(f"🔍 檢查 ID {post_id}...")
                    
                    status, reason = self.check_content(content)
                    
                    cur.execute(
                        'UPDATE "posts" SET ai_status = %s, ai_reason = %s WHERE id = %s',
                        (status, reason, post_id)
                    )
                    conn.commit()
                    print(f"✅ ID {post_id} -> {status} ({reason})")

                time.sleep(2)
        except Exception as e:
            print(f"❌ 錯誤: {e}")
        finally:
            if 'conn' in locals():
                conn.close()

if __name__ == "__main__":
    worker = AIDBWorker()
    worker.run()