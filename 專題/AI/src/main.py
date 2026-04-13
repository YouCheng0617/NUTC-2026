import ollama

class LocalStickyNoteAI:
    """
    資管系專題：本地 AI 模組 (Ollama 版)
    功能：內容審核、自動分類、標籤生成
    """
    
    def __init__(self, model_name="llama3.2:1b"):
        # 使用輕量化模型，確保一般筆電也能流暢運行
        self.model_name = model_name
        print(f"🏠 本地 AI 引擎初始化：使用模型 {self.model_name}")

    def _invoke_ai(self, prompt):
        try:
            # 這裡加入了 timeout=120，代表給 AI 兩分鐘的時間思考，不會輕易崩潰
            response = ollama.chat(
                model=self.model_name, 
                messages=[{'role': 'user', 'content': prompt}],
                options={'num_predict': 100}, # 限制字數可以跑更快
            )
            return response['message']['content']
        except Exception as e:
            print(f"⚠️ AI 服務回應過慢或錯誤: {e}")
            return '{"s": "通過", "r": "AI回應超時"}'

    def check_content(self, text):
        """功能 1：自動審核貼文內容（強硬格式版）"""
        prompt = f"""
你現在是一個社交平台的內容審核員。請審核以下「漂流瓶」內容：
「{text}」

審核標準（若違反任一項，請判定為「不通過」）：
1. 暴力與恐嚇：嚴禁任何威脅他人安全、毀損財物或暴力傾向的內容。
2. 個人隱私：嚴禁分享電話號碼、聯絡方式（LINE ID、手機號碼等）。
3. 侮辱與霸凌：嚴禁人身攻擊、謾罵、汙辱性詞彙或歧視言論。

請嚴格執行。僅回傳 JSON 格式：
{{
  "ai_status": "通過" 或 "不通過",
  "ai_reason": "違反暴力規定" 或 "含有電話隱私" 或 "涉及侮辱言論" 或 "無"
}}
"""
        return self._invoke_ai(prompt)

    def get_category(self, text):
        """功能 2：自動分類便利貼"""
        prompt = (f"請分析這段話的類型：『{text}』。"
                  f"從 [心情點滴, 技術分享, 匿名告白, 生活瑣事] 選一個最適合的類別，只需回傳類別名稱。")
        return self._invoke_ai(prompt)

    def get_user_tags(self, intro, interests):
        """功能 3：分析會員特質標籤"""
        prompt = f"分析自介『{intro}』與興趣『{interests}』，提取三個反映性格的標籤，用逗號隔開。只需回傳標籤。"
        return self._invoke_ai(prompt)

# --- 專題開發測試區 ---
if __name__ == "__main__":
    ai = LocalStickyNoteAI()
    print("\n" + "="*40)
    print("🚀 內部邏輯測試中...")
    
    # 測試審核
    test_text = "這是一個測試訊息，系統運作正常！"
    print(f"測試審核: {ai.check_content(test_text)}")
    
    # 測試分類
    print(f"測試分類: {ai.get_category(test_text)}")
    
    print("="*40)