from flask import Flask, request, jsonify
from flask_cors import CORS
from main import LocalStickyNoteAI

app = Flask(__name__)
CORS(app) # 加上 CORS 允許前端跨域請求

ai = LocalStickyNoteAI()

# 原本就有的漂流瓶審核功能
@app.route('/api/check', methods=['POST'])
def check():
    data = request.json or {}
    text = data.get('content', '')
    result = ai.check_content(text)
    category = ai.get_category(text)
    return jsonify({
        "status": result.get("ai_status", "通過"),
        "reason": result.get("ai_reason", "無"),
        "category": category
    })

# ✨ 新增：AI 聊天小助理
@app.route('/api/chat', methods=['POST'])
def chat_endpoint():
    data = request.get_json() or {}
    message = data.get('message', '')
    if not message.strip():
        return jsonify({"error": "訊息不能為空"}), 400

    reply = ai.chat_assistant(message)
    return jsonify({
        "status": "success",
        "reply": reply
    })

# ✨ 新增：AI 塔羅牌解牌
@app.route('/api/tarot', methods=['POST'])
def tarot_endpoint():
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
    app.run(host='0.0.0.0', port=5000)