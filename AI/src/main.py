# 畢業專案：智慧便利貼 AI 審核模組
# 當前環境：本地 Ollama (gemma2:2b)
# 功能：內容審核、自動分類、標籤生成
import requests
import json
import time

class LocalStickyNoteAI:
    """
    資管系專題：本地 AI 模組 (Ollama 版)
    優點：不限次數、不花錢、開發測試最快。
    """
    
    def __init__(self, model_name="gemma2:2b"):
        # Ollama 預設的本地 API 位址
        self.api_url = "http://localhost:11434/api/generate"
        self.model = model_name
        print(f"🏠 本地 AI 引擎初始化：使用模型 {self.model}")

    def _invoke_ai(self, prompt):
        """核心呼叫：發送請求給本地 Ollama"""
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,  # 設為 False 才會一次回傳整段文字，方便程式處理
            "options": {
                "temperature": 0.7 # 讓 AI 回答稍微有一點彈性
            }
        }
        
        try:
            # 發送 POST 請求到本地伺服器
            response = requests.post(self.api_url, json=payload, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                return result.get("response", "").strip()
            else:
                return f"❌ Ollama 伺服器異常 (錯誤碼: {response.status_code})"
                
        except Exception as e:
            return f"❌ 連線失敗：請確認 Ollama 是否已啟動。錯誤: {str(e)}"

    def check_content(self, text):
        """功能 1：自動審核貼文內容"""
        p = (f"你是一個社群管理員，請審核這段內容是否違規（暴力、詐騙、色情）：『{text}』。"
             f"請嚴格遵守格式回傳：『通過|無』或『不通過|原因』。不要說多餘的話。")
        return self._invoke_ai(p)

    def get_category(self, text):
        """功能 2：自動分類便利貼"""
        p = (f"請分析這段話的類型：『{text}』。"
             f"從 [心情點滴, 技術分享, 匿名告白, 生活瑣事] 選一個最適合的類別，只需回傳類別名稱。")
        return self._invoke_ai(p)

    def get_user_tags(self, intro, interests):
        """功能 3：分析會員特質標籤"""
        p = f"分析自介『{intro}』與興趣『{interests}』，提取三個反映性格的標籤，用逗號隔開。只需回傳標籤。"
        return self._invoke_ai(p)

# --- 專題開發測試區 ---
if __name__ == "__main__":
    try:
        # 1. 建立 AI 物件 (確認模型名稱跟妳 ollama list 看到的一樣)
        ai_service = LocalStickyNoteAI(model_name="gemma2:2b")
        
        print("\n" + "="*40)
        print("🚀 本地智慧後台測試開始 (Ollama)")
        print("="*40)
        
        # 2. 測試：便利貼審核與分類
        sample_post = "今天終於把資料庫連通了，寫程式真的很有趣！"
        print(f"【測試貼文】: {sample_post}")
        
        # 呼叫審核功能
        check_result = ai_service.check_content(sample_post)
        print(f"👉 審核結果: {check_result}")
        
        # 呼叫分類功能
        cat_result = ai_service.get_category(sample_post)
        print(f"👉 建議分類: {cat_result}")
        
        print("-" * 40)
        # 測試：便利貼審核與分類
        sample_post = "召集詐騙集團一起出征！"
        print(f"【測試貼文】: {sample_post}")
        
        # 呼叫審核功能
        check_result = ai_service.check_content(sample_post)
        print(f"👉 審核結果: {check_result}")
        
        # 呼叫分類功能
        cat_result = ai_service.get_category(sample_post)
        print(f"👉 建議分類: {cat_result}")
        
        print("-" * 40)
        
        # 3. 測試：會員特質標籤
        print("👤 正在生成會員特質標籤...")
        tags = ai_service.get_user_tags("我是一個熱愛生活、喜歡研究新科技的資管系學生", "寫程式, 攝影, 旅遊")
        print(f"👉 生成標籤: {tags}")
        
        print("="*40)
        print("✨ 測試完成！本地 AI 運作正常。")

    except Exception as e:
        print(f"❌ 發生非預期錯誤: {e}")