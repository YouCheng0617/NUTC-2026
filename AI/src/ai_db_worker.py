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

AI_UNAVAILABLE_REASONS = {"AI回應異常防護", "無 API Key 防護"}

class AIWorker:
    def __init__(self):
        print("🤖 [AI 審核工人] 系統初始化中 (純 API 模式)...")
        self.ai_engine = LocalStickyNoteAI()
        
        # 定義共同的 Request Headers，靠這把鑰匙通過 adminCheck
        self.headers = {
            "Content-Type": "application/json",
            "x-ai-api-key": API_KEY 
        }

    def check_content(self, content):
        """
        交給 Gemini 審核內容（main.py 的 LocalStickyNoteAI.check_content：暴力恐嚇、透露個資、侮辱霸凌）
        回傳三個值: (status_str, reason, category)，status_str 是 "通過" 或 "違規"
        Gemini 暫時沒回應（忙線、沒設金鑰、出錯）時回傳 None：瓶子先留在待審核，下一輪再審，不直接放行
        """
        try:
            result = self.ai_engine.check_content(content) or {}
            # main.py 在 Gemini 出錯或沒設金鑰時會回「通過」加上這兩種原因，那其實是沒審到
            if result.get("ai_reason") in AI_UNAVAILABLE_REASONS:
                return None
            if result.get("ai_status") == "通過":
                return "通過", "", ""
            return "違規", result.get("ai_reason") or "內容不符合海神殿規", ""
        except Exception as e:
            print(f"⚠️ AI 審核過程發生錯誤: {e}")
            return None

        
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
                ai_unavailable = False
                for bottle in pending_bottles:
                    post_id = bottle.get("bottle_id")
                    content = bottle.get("content")

                    print(f"🔍 AI 開始檢查 ID {post_id}...")

                    # 交給 AI 審核；AI 暫時沒回應就先跳過，這一批剩下的也等下一輪
                    verdict = self.check_content(content)
                    if verdict is None:
                        print(f"⏳ ID {post_id} AI 暫時無法審核，先留在待審核，稍後再試")
                        ai_unavailable = True
                        break
                    ai_status_str, reason, category = verdict
                    
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

                # 處理完一批後稍微休息，避免 API 請求過於頻繁；AI 忙線時多等一下再試
                time.sleep(15 if ai_unavailable else 2)

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