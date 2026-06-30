import os
from dotenv import load_dotenv
from google import genai

env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(env_path)

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

print("🔍 正在幫你篩選出『純文字/通用』的 Gemini 模型...")
try:
    models = client.models.list()
    for m in models:
        name = m.name
        # 過濾掉語音、影像、即時翻譯等特殊用途的模型，只找 flash 或 pro
        if all(keyword not in name for keyword in ["audio", "live", "veo", "imagen", "embedding", "aqa", "translate"]):
            if "flash" in name or "pro" in name:
                # 自動幫你把前面的 models/ 切掉，印出能直接貼進 main.py 的名字
                clean_name = name.replace("models/", "")
                print(f"👉 推薦使用: {clean_name}")
except Exception as e:
    print(f"❌ 查詢發生錯誤: {e}")