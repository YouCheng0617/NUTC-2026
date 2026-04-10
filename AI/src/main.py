import requests

def analyze(content):
    url = "http://localhost:11434/api/generate"
    payload = {
        "model": "gemma2:2b",
        # 這裡把指令改成中文，並規定它回傳中文單字
        "prompt": f"請分析以下文字的情緒，只准回傳『正面』、『負面』或『中性』其中一個詞，不要有其他廢話：{content}",
        "stream": False
    }
    
    try:
        r = requests.post(url, json=payload, timeout=30)
        if r.status_code == 200:
            return r.json().get('response', '無法辨識').strip()
        else:
            return f"錯誤代碼: {r.status_code}"
    except Exception:
        return "連線失敗"

if __name__ == "__main__":
    print("=== AI 情緒分析系統 (中文版) 已啟動 ===")
    while True:
        text = input("請輸入內容 (q 離開): ")
        if text.lower() == 'q':
            break
        if not text.strip():
            continue
            
        res = analyze(text)
        print(f"分析結果: {res}")
        print("-" * 30)