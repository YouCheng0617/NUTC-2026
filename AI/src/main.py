import os
import json
import re
from dotenv import load_dotenv
from google import genai
from google.genai import types

# 加載環境變數
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(env_path)

# 設定 Gemini API 金鑰並初始化新版 Client
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_KEY:
    client = genai.Client(api_key=GEMINI_KEY)
else:
    print("⚠️ 警告：未在 .env 中偵測到 GEMINI_API_KEY")
    client = None

class LocalStickyNoteAI:
    """
    資管系專題：校園 AI 模組 (Google GenAI 最新版 SDK)
    功能：內容審核、自動分類、標籤生成
    """
    
    def __init__(self, model_name="gemini-3.0-flash"):
        self.model_name = model_name
        print(f"✨ Gemini AI 引擎初始化：使用模型 {self.model_name}")

    def check_content(self, text):
        """功能 1：自動審核貼文內容（使用官方 JSON 模式）"""
        if not client: return {"ai_status": "通過", "ai_reason": "無 API Key 防護"}
        
        prompt = f"""
        你現在是一個社交平台的內容審核員。請審核以下「漂流瓶」內容：
        「{text}」

        審核標準（若違反任一項，請判定為「不通過」）：
        1. 暴力與恐嚇：嚴禁威脅他人安全、毀損財物或暴力傾向。
        2. 個人隱私：嚴禁分享電話號碼、LINE ID、手機號碼。
        3. 侮辱與霸凌：嚴禁人身攻擊、謾罵、歧視言論。

        請嚴格遵循以下 JSON 格式回傳，不要有任何額外的解釋或中文字：
        {{
          "ai_status": "通過" 或 "不通過",
          "ai_reason": "原因說明"
        }}
        """
        
        try:
            # 最新版的 generate_content 寫法
            response = client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                ),
            )
            return json.loads(response.text)
        except Exception as e:
            print(f"⚠️ Gemini 審核異常: {e}")
            return {"ai_status": "通過", "ai_reason": "AI回應異常防護"}

    def get_category(self, text):
        """功能 2：自動分類便利貼 (回傳前端指定的數字代號 1~4)"""
        if not client: return 2
        
        prompt = f"""
        請嚴格分析這段漂流瓶文字：『{text}』。
        並從以下四個類別中，選擇一個最符合這段話心境的「數字代號」回傳：
        1 : 代表極度憤怒、生氣、不滿、抱怨、罵人
        2 : 代表秘密、心事、沒人知道的事情、悄悄話、表白
        3 : 代表傷心、難過、失戀、破碎、沮喪、想哭
        4 : 代表厭世、無聊、躺平、不想工作或上學、生活日常瑣事

        ⚠️ 規則：你「只能」且「必須」回傳數字 1、2、3 或 4 的其中一個。絕對不要輸出任何其他中文字、標點符號、括號或空格。
        """
        
        try:
            response = client.models.generate_content(
                model=self.model_name,
                contents=prompt,
            )
            result_text = response.text.strip()
            
            # 確保拿出來的是乾淨的數字
            if result_text in ["1", "2", "3", "4"]:
                return int(result_text)
                
            # 防呆：萬一 AI 還是加了廢話，強制從中挖出 1~4 的數字
            digits = re.findall(r'[1-4]', result_text)
            if digits:
                return int(digits[0])
                
        except Exception as e:
            print(f"⚠️ Gemini 分類異常: {e}")
            
        return 2  # 防呆預設值

    def get_user_tags(self, intro, interests):
        """功能 3：分析會員特質標籤"""
        if not client: return "熱情, 友善, 學習者"
        
        prompt = f"分析自介『{intro}』與興趣『{interests}』，提取三個反映性格的中文標籤，用逗號隔開。只需回傳標籤。"
        try:
            response = client.models.generate_content(
                model=self.model_name,
                contents=prompt,
            )
            return response.text.strip()
        except Exception as e:
            return "熱情, 友善, 學習者"


# --- 專題測試區 ---
if __name__ == "__main__":
    ai = LocalStickyNoteAI()
    print("\n" + "="*40)
    print("🚀 Gemini 新版 SDK 內部邏輯測試中...")
    
    test_text = "今天微積分被當掉，真的很不爽，超討厭教授的！"
    print(f"測試文字：{test_text}")
    print(f"1. 審核結果: {ai.check_content(test_text)}")
    print(f"2. 分類結果 (數字): {ai.get_category(test_text)}")
    print("="*40)