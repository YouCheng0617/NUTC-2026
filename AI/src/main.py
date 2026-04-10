import requests

class StickyNoteAI:
    def __init__(self):
        # 指向本地 Ollama 服務
        self.api_url = "http://localhost:11434/api/generate"
        self.model = "gemma2:2b"

    def _invoke_ai(self, prompt):
        """通用發送邏輯"""
        payload = {"model": self.model, "prompt": prompt, "stream": False}
        try:
            r = requests.post(self.api_url, json=payload, timeout=40)
            return r.json().get('response', '').strip()
        except Exception:
            return "ERR_CONNECTION"

    def check_content(self, text):
        """
        功能 1：自動審核
        對應資料庫：審核狀態、違規原因
        """
        p = f"分析這句話是否違規（色情、暴力、詐騙）:『{text}』。輸出格式：狀態|原因（例如：通過|無 或 不通過|包含暴力言論）"
        return self._invoke_ai(p)

    def get_category(self, text):
        """
        功能 2：自動分類
        對應資料庫：類別名稱、擁有 (關聯表)
        """
        p = f"從 [心情點滴, 技術分享, 匿名告白, 生活瑣事] 選一個類別給這段話：『{text}』。僅回傳類別名稱。"
        return self._invoke_ai(p)

    def get_user_tags(self, intro, interests):
        """
        功能 3：自介摘要標籤
        對應資料庫：會員自介、興趣
        """
        p = f"根據自介『{intro}』與興趣『{interests}』，提取三個個人特質標籤，用逗號隔開。"
        return self._invoke_ai(p)

# --- 下方為測試用程式碼，確定沒問題後可以刪除 ---
if __name__ == "__main__":
    ai = StickyNoteAI()
    print("正在進行系統功能測試...")
    
    # 測試審核
    print(f"1. 審核結果: {ai.check_content('這是一個測試便利貼')}")
    # 測試分類
    print(f"2. 分類建議: {ai.get_category('今天學會了 Python 寫法')}")
    # 測試標籤
    print(f"3. 特質標籤: {ai.get_user_tags('資管系學生，喜歡寫扣', '籃球, 程式')}")