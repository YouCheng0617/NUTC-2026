# src/main.py
# 2026/04/11 先寫個大概，之後再接 Gemini API
# TODO: 補上 API Key 呼叫邏輯

def mood_check(user_msg):
    # 這邊之後要改成串接 API
    # 暫時先用關鍵字判斷頂著用，Demo 比較快
    
    print("AI 正在想...") # 讓組員看到有在動
    
    msg = user_msg.strip() # 去掉空白比較保險
    
    if "開心" in msg or "超棒" in msg or "好耶" in msg:
        res = "Positive"
    elif "難過" in msg or "哭" in msg or "爛" in msg:
        res = "Negative"
    else:
        res = "Neutral"
        
    return res

if __name__ == "__main__":
    print("--- 數位便利貼 AI 偵測系統 v1.0 ---")
    
    # 測試用
    while True:
        txt = input("輸入便利貼文字 (按 q 離開): ")
        if txt == 'q':
            break
            
        result = mood_check(txt)
        print("分析結果是: " + result)
        print("-" * 20)