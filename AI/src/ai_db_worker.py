import os
import time
import requests
from dotenv import load_dotenv
from main import LocalStickyNoteAI

# --- 1. 環境變數加載與安全檢查 ---
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(env_path)

WEBHOOK_URL = os.getenv("BACKEND_URL")
API_KEY = os.getenv("AI_SECRT_KEY")

if not WEBHOOK_URL:
    print("⚠️ 警告：環境變數缺少 BACKEND_URL")
if not API_KEY:
    print("⚠️ 警告：環境變數缺少 AI_SECRT_KEY")

class AIWorker:
    def __init__(self):
        print("🤖 [AI 審核工人] 系統初始化中 (純 API 模式)...")
        self.ai_engine = LocalStickyNoteAI()
        
        # 定義共同的 Request Headers，靠這把鑰匙通過 adminCheck
        self.headers = {
            "Content-Type": "application/json",
            "x-ai-api-key": API_KEY 
        }

    # 💡 補上缺失的 check_content 函數
    def check_content(self, content):
        """
        呼叫 AI 引擎審核內容
        回傳必須是三個值: (status_str, reason, category)
        status_str 必須是 "通過" 或 "違規"
        """
        try:
            # 這裡需要根據你的 LocalStickyNoteAI 實際寫法來改
            # 假設它有一個審核的方法叫做 analyze 或 review
            # result = self.ai_engine.review(content) 
            
            # --- 以下為範例邏輯，請根據你的 AI 輸出格式調整 ---
            # 舉例：如果內容包含敏感詞
            if "測試違規詞" in content:
                return "違規", "包含不當言論", "違規類別"
            
            # 預設通過
            return "通過", "", ""
            # ----------------------------------------------
            
        except Exception as e:
            print(f"⚠️ AI 審核過程發生錯誤: {e}")
            return "違規", "AI 審核出錯", "錯誤"

        
    def run(self):
        """背景監聽 API 迴圈"""
        print(f"🚀 [背景審核工人] 啟動成功！開始輪詢後端 API...")
        
        while True:
            try:
                # 🌟 1. 改走 GET API 來獲取清單，不再直連資料庫！
                api_get_url = f"{WEBHOOK_URL}/admin/bottles"
                get_res = requests.get(api_get_url, headers=self.headers)

                if get_res.status_code != 200:
                    print(f"❌ 獲取清單失敗 (HTTP {get_res.status_code}): {get_res.text}")
                    time.sleep(5)
                    continue

                # 解析後端傳來的 JSON 資料 (依照你的 API 格式，應該放在 data 裡面)
                res_json = get_res.json()
                bottles = res_json.get("data", [])

                # 篩選出 status 為 0 (待審核) 的瓶子
                pending_bottles = [b for b in bottles if b.get("status") == 0]

                if not pending_bottles:
                    # 如果沒有待處理的文章，休息 3 秒再問一次
                    time.sleep(3)
                    continue

                # 🌟 2. 開始逐一處理待審核的清單
                for bottle in pending_bottles:
                    post_id = bottle.get("bottle_id")
                    content = bottle.get("content")
                    
                    print(f"🔍 AI 開始檢查 ID {post_id}...")
                    
                    # 交給 AI 審核
                    ai_status_str, reason, category = self.check_content(content)
                    
                    # 狀態對齊後端：1 = 通過, 2 = 違規
                    target_status = 1 if ai_status_str == "通過" else 2
                    
                    # 🌟 3. 發送 PUT 請求去更新狀態
                    api_put_url = f"{WEBHOOK_URL}/admin/bottles/review"
                    payload = {
                        "bottle_id": post_id,
                        "status": target_status,
                        "violation_reason": reason if target_status == 2 else ""
                    }
                    
                    put_res = requests.put(api_put_url, json=payload, headers=self.headers)
                    
                    if put_res.status_code == 200:
                        print(f"✅ ID {post_id} 成功透過 API 處理完成 -> 狀態更新為: {target_status}")
                    else:
                        print(f"❌ 審核 API 回報錯誤 {put_res.status_code}: {put_res.text}")

                # 處理完一批後稍微休息，避免 API 請求過於頻繁
                time.sleep(2)

            except requests.exceptions.RequestException as e:
                print(f"❌ 無法連線到後端伺服器，請檢查 BACKEND_URL 是否正確: {e}")
                time.sleep(5)
            except Exception as e:
                print(f"❌ 發生未預期的嚴重錯誤: {e}")
                time.sleep(5)

# === 底部啟動區塊 ===
if __name__ == "__main__":
    try:
        worker = AIWorker()
        worker.run()
    except KeyboardInterrupt:
        print("\n👋 系統管理員手動關閉背景審核工人。")