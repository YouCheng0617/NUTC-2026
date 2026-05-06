from flask import Flask, request, jsonify
from main import LocalStickyNoteAI

app = Flask(__name__)
ai = LocalStickyNoteAI()

@app.route('/api/check', methods=['POST'])
def check():
    data = request.json
    text = data.get('content', '')
    # 調用你的 AI 引擎
    result = ai.check_content(text)
    category = ai.get_category(text)
    return jsonify({
        "status": result.get("ai_status"),
        "reason": result.get("ai_reason"),
        "category": category
    })

if __name__ == '__main__':
    app.run(port=5000)