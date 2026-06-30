import requests
import urllib3

# 💡 小優化：因為我們測試時用 verify=False，會跳出一大堆 SSL 警告。
# 加這行可以把那些煩人的黃字警告關掉，讓終端機畫面比較乾淨。
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 載入你寫好的 AI 大腦
from main import LocalStickyNoteAI 

ai = LocalStickyNoteAI()
BACKEND_URL = "https://163.17.135.120/bottles/random"

def fetch_and_analyze_bottles():
    print("📡 正在向後端請求隨機漂流瓶...")
    try:
        response = requests.get(BACKEND_URL, verify=False)
        
        if response.status_code == 200:
            data = response.json()
            # 抓取 bottles 陣列
            bottles = data.get('bottles', []) 
            
            print(f"📥 成功抓到 {len(bottles)} 個瓶子！開始自動審核：\n")
            
            # 使用迴圈一次處理抓回來的 10 個瓶子
            for bottle in bottles:
                bottle_id = bottle.get('bottle_id')
                text = bottle.get('content', '')
                
                print("=" * 40)
                print(f"🔍 [ID: {bottle_id}] 準備分析內容: {text}")
                
                # 防呆機制：避免使用者發出完全空白的文章
                if text and str(text).strip(): 
                    review_result = ai.check_content(text)
                    category = ai.get_category(text)
                    
                    print(f"✅ AI 審核: {review_result}")
                    print(f"🏷️ AI 分類: {category}")
                else:
                    print("⚠️ 這篇內容是空的，跳過 AI 審核。")
                    
            print("=" * 40)
            print("🎉 本批次漂流瓶全數檢查完畢！")
            
        else:
            print(f"❌ 請求失敗，狀態碼：{response.status_code}")
            
    except Exception as e:
        print(f"❌ 連線發生錯誤：{e}")

if __name__ == "__main__":
    fetch_and_analyze_bottles()