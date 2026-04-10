# src/main.py

def analyze(s):
    # s = s.strip()
    if not s: return "No input"
    
    # 暫時先這樣
    p_list = ["開心", "棒", "好", "爽"]
    n_list = ["難過", "哭", "死", "累"]
    
    for p in p_list:
        if p in s: return "Positive"
        
    for n in n_list:
        if n in s: return "Negative"
        
    return "Neutral"

if __name__ == "__main__":
    while True:
        txt = input("Enter text: ")
        if txt == 'q': break
        
        res = analyze(txt)
        print("Result:", res)