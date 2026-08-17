from flask import Flask, request, jsonify
from flask_cors import CORS  # 解決跨域問題，前端串接必備
from main import LocalStickyNoteAI

app = Flask(__name__)
CORS(app)  # 讓網頁前端可以順利存取這個 API

# 初始化你的 AI 大腦
ai = LocalStickyNoteAI()

@app.route('/api/analyze', methods=['POST'])
def analyze_content():
    """
    這是一個 API 接口
    前端傳送：{"content": "貼文內容"}
    回傳結果：AI 審核狀態與分類
    """
    data = request.get_json()
    
    if not data or 'content' not in data:
        return jsonify({"error": "請提供 content 內容"}), 400
    
    text = data['content']
    
    # 1. 呼叫 AI 進行審核
    review = ai.check_content(text)
    
    # 2. 呼叫 AI 進行分類
    category = ai.get_category(text)
    
    # 3. 回傳整合結果
    return jsonify({
        "status": "success",
        "data": {
            "content": text,
            "ai_status": review.get("ai_status", "通過"),
            "ai_reason": review.get("ai_reason", "無"),
            "category": category
        }
    })

@app.route('/api/chat', methods=['POST'])
def chat_endpoint():
    """AI 小助理聊天接口"""
    data = request.get_json() or {}
    message = data.get('message', '')
    if not message.strip():
        return jsonify({"error": "訊息不能為空"}), 400

    reply = ai.chat_assistant(message)
    return jsonify({
        "status": "success",
        "reply": reply
    })

@app.route('/api/tarot', methods=['POST'])
def tarot_endpoint():
    """AI 塔羅牌解牌接口"""
    data = request.get_json() or {}
    card_name = data.get('card_name', '愚者')
    orientation = data.get('orientation', '正位')
    question = data.get('question', '今日運勢')

    analysis = ai.analyze_tarot(card_name, orientation, question)
    return jsonify({
        "status": "success",
        "analysis": analysis
    })

if __name__ == '__main__':
    # 啟動 API 伺服器，監聽 5000 埠口
    print("🚀 AI API Server 啟動中...")
    print("📍 接口網址：http://127.0.0.1:5000/api/analyze")
    app.run(host='0.0.0.0', port=5000, debug=False)