import os
from dotenv import load_dotenv

# 讀取 .env 檔案內容
load_dotenv()

def run_worker():
    # 改成 os.getenv，這樣程式就會去 .env 裡找資料
    db_config = {
        "host": os.getenv("DB_HOST", "localhost"),
        "port": os.getenv("DB_PORT", "5432"),
        "user": os.getenv("DB_USER", "postgres"),
        "password": os.getenv("DB_PASSWORD"), 
        "database": os.getenv("DB_NAME", "driftBottle")
    }
    # ... 其餘代碼不變 ...
try:
    import psycopg2
except ImportError:
    print("❌ 找不到 psycopg2 套件。請執行: pip install psycopg2-binary")
    exit(1)

import time
try:
    from main import LocalStickyNoteAI 
except ImportError:
    print("❌ 找不到 main.py 或裡面的 LocalStickyNoteAI 類別。")
    print("請確保 main.py 已經存檔，且 class 名稱拼寫正確！")
    exit(1)

def run_worker():
    # 使用輕量級 llama3.2:1b 加速處理
    ai_service = LocalStickyNoteAI(model_name="llama3.2:1b")
    
    db_config = {
        "host": "localhost",
        "port": "5432",
        "user": "postgres",
        "password": "0627", 
        "database": "driftBottle"
    }

    print("🚀 AI 自動審核機器人啟動（llama3.2 加速版）...")
    print("📡 監控中... 發現新漂流瓶將自動進行 AI 審核。")

    while True:
        try:
            conn = psycopg2.connect(**db_config)
            cursor = conn.cursor()

            # 抓取尚未被 AI 判定過（ai_status 為 NULL 或空）的資料
            cursor.execute("SELECT id, content FROM posts WHERE ai_status IS NULL OR ai_status = '' OR ai_status = '無'")
            rows = cursor.fetchall()

            if rows:
                print(f"🔍 發現 {len(rows)} 則待審核內容...")
                for post_id, content in rows:
                    print(f"🤖 正在分析 ID {post_id}...")
                    start_time = time.time()
                    
                    # 呼叫 main.py 裡的強硬版審核指令
                    result = ai_service.check_content(content) 
                    
                    # 解析 AI 回傳的格式 (通過|無)
                    if "|" in result:
                        parts = result.split("|", 1)
                        status = parts[0].strip()
                        reason = parts[1].strip()
                    elif "不通過" in result:
                        status, reason = "不通過", "內容違反社群規範"
                    else:
                        status, reason = "通過", "無"

                    # 將結果寫回 PostgreSQL
                    cursor.execute(
                        "UPDATE posts SET ai_status=%s, ai_reason=%s WHERE id=%s",
                        (status[:10], reason[:50], post_id)
                    )
                    
                    end_time = time.time()
                    print(f"✅ ID {post_id} 處理完成！結果：[{status}]，耗時: {end_time - start_time:.2f} 秒")
                
                # 正式提交變更到資料庫
                conn.commit()
            
            cursor.close()
            conn.close()
            
        except Exception as e:
            print(f"❌ 運作中發生錯誤: {e}")

        # 每 5 秒巡邏一次資料庫
        time.sleep(5)

if __name__ == "__main__":
    run_worker()