import ollama
import json
import re

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
            # 加入 timeout 與 num_predict，控制輸出速度與穩定度
            response = ollama.chat(
                model=self.model_name, 
                messages=[{'role': 'user', 'content': prompt}],
                options={
                    'num_predict': 150,  # 限制輸出長度
                    'temperature': 0.1   # 降低隨機性，讓格式更固定
                },
            )
            return response['message']['content']
        except Exception as e:
            print(f"⚠️ AI 服務回應過慢或錯誤: {e}")
            # 如果出錯，回傳一個標準的 JSON 格式字串，避免後端解析崩潰
            return '{"ai_status": "通過", "ai_reason": "AI回應異常"}'

    def check_content(self, text):
        """功能 1：自動審核貼文內容（強硬格式版 + JSON 挖掘）"""
        prompt = f"""
        你現在是一個社交平台的內容審核員。請審核以下「漂流瓶」內容：
        「{text}」

        審核標準（若違反任一項，請判定為「不通過」）：
        1. 暴力與恐嚇：嚴禁威脅他人安全、毀損財物或暴力傾向。
        2. 個人隱私：嚴禁分享電話號碼、LINE ID、手機號碼。
        3. 侮辱與霸凌：嚴禁人身攻擊、謾罵、歧視言論。

        [重要規則]：必須「僅回傳」JSON 格式，不要有任何解釋。
        {{
          "ai_status": "通過" 或 "不通過",
          "ai_reason": "原因說明"
        }}
        """
        raw_res = self._invoke_ai(prompt)
        
        # --- 強力 JSON 挖掘邏輯 ---
        # 即使 AI 回傳：「好的，這是我幫你審核的結果：{...}」，我們也能把中間的 {} 挖出來
        try:
            match = re.search(r'\{.*\}', raw_res, re.DOTALL)
            if match:
                return json.loads(match.group())
            else:
                return {"ai_status": "通過", "ai_reason": "AI未按格式回傳"}
        except Exception as e:
            return {"ai_status": "通過", "ai_reason": f"解析失敗: {str(e)}"}

    def get_category(self, text):
        """功能 2：自動分類便利貼"""
        prompt = (f"請分析這段話的類型：『{text}』。"
                  f"從 [心情點滴, 技術分享, 匿名告白, 生活瑣事] 選一個最適合的類別，只需回傳類別名稱。")
        res = self._invoke_ai(prompt)
        # 清理掉 AI 可能多噴出來的句號或空格
        return res.strip().replace("。", "") if res else "未分類"

    def get_user_tags(self, intro, interests):
        """功能 3：分析會員特質標籤"""
        prompt = f"分析自介『{intro}』與興趣『{interests}』，提取三個反映性格的標籤，用逗號隔開。只需回傳標籤。"
        res = self._invoke_ai(prompt)
        return res.strip() if res else "熱情, 友善, 學習者"

# --- 專題開發測試區 (if __name__ == "__main__" 代表直接執行此檔案時才會跑，import 時不會跑) ---
if __name__ == "__main__":
    ai = LocalStickyNoteAI()
    print("\n" + "="*40)
    print("🚀 內部邏輯測試中...")
    
    # 測試 1：正常訊息
    test_text_1 = "今天去圖書館看書，感覺心情很平靜。"
    print(f"1. 測試正常審核: {ai.check_content(test_text_1)}")
    print(f"1. 測試分類: {ai.get_category(test_text_1)}")
    
    print("-" * 20)

    # 測試 2：違規訊息 (含電話)
    test_text_2 = "想認識我的話可以打 0912-345-678 找我喔！"
    print(f"2. 測試違規審核: {ai.check_content(test_text_2)}")
    
    print("-" * 20)
    
    # 測試 3：標籤生成
    print(f"3. 測試標籤: {ai.get_user_tags('我是個愛運動的人', '籃球, 游泳, 爬山')}")
    
    print("="*40)