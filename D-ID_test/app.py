from flask import Flask, render_template, request, jsonify
import requests
import os
from datetime import datetime 

app = Flask(__name__)

# 從環境變數讀取 API Key 和 Agent ID !!! 就修改這裡就好~~
DID_API_KEY = "" 
AGENT_ID = ""
AGENT_SOURCE_URL = ""

# 用於儲存每個 Flask session 的 chat_id

from flask import session
app.secret_key = '123' # 用於 Flask session 加密，隨便設置一個複雜的字串 真的就隨便

D_ID_API_URL = "https://api.d-id.com"

common_headers = {
    "Authorization": DID_API_KEY,
    "Content-Type": "application/json"
}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/create_stream', methods=['POST'])
def create_stream():
    """
    步驟 1 (Talks Streams API): 創建一個新的 stream
    """
    try:
        response = requests.post(
            f"{D_ID_API_URL}/talks/streams",
            headers=common_headers,
            json={"source_url": AGENT_SOURCE_URL}
        )
        response.raise_for_status() # 如果請求失敗 (狀態碼 4xx or 5xx), 會拋出 HTTPError 頭痛QQ
        stream_data = response.json()
        # stream_data 應該包含: id (talk_stream_id), session_id (talk_session_id), offer, ice_servers
        return jsonify(stream_data)
    except requests.exceptions.RequestException as e:
        print(f"Error creating stream: {e}")
        if e.response is not None:
            print(f"Error response: {e.response.text}")
            return jsonify({"error": str(e), "details": e.response.text}), e.response.status_code
        return jsonify({"error": str(e)}), 500


@app.route('/api/start_stream_sdp', methods=['POST'])
def start_stream_sdp():
    """
    步驟 2 (Talks Streams API): 發送 SDP answer
    """
    data = request.json
    stream_id = data.get('stream_id') # 這是 talk_stream_id
    session_id = data.get('session_id') # 這是 talk_session_id
    answer = data.get('answer') # 這是 SDP answer

    if not all([stream_id, session_id, answer]):
        return jsonify({"error": "Missing stream_id, session_id, or answer"}), 400

    try:
        response = requests.post(
            f"{D_ID_API_URL}/talks/streams/{stream_id}/sdp",
            headers=common_headers,
            json={
                "answer": answer,
                "session_id": session_id
            }
        )
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.RequestException as e:
        print(f"Error sending SDP answer: {e}")
        if e.response is not None:
            print(f"Error response: {e.response.text}")
            return jsonify({"error": str(e), "details": e.response.text}), e.response.status_code
        return jsonify({"error": str(e)}), 500


@app.route('/api/send_ice_candidate', methods=['POST'])
def send_ice_candidate():
    """
    步驟 3 (Talks Streams API): 發送 ICE candidate
    """
    data = request.json
    stream_id = data.get('stream_id') # 這是 talk_stream_id
    session_id = data.get('session_id') # 這是 talk_session_id
    candidate_data = data.get('candidate_data') # 包含 candidate, sdpMid, sdpMLineIndex

    if not all([stream_id, session_id, candidate_data]):
        return jsonify({"error": "Missing stream_id, session_id, or candidate_data"}), 400

    payload = {
        "candidate": candidate_data.get("candidate"),
        "sdpMid": candidate_data.get("sdpMid"),
        "sdpMLineIndex": candidate_data.get("sdpMLineIndex"),
        "session_id": session_id
    }

    try:
        response = requests.post(
            f"{D_ID_API_URL}/talks/streams/{stream_id}/ice",
            headers=common_headers,
            json=payload
        )
        response.raise_for_status()
        return jsonify(response.json()) # 或者只是 jsonify({"status": "success"}) 真的是翻死
    except requests.exceptions.RequestException as e:
        print(f"Error sending ICE candidate: {e}")
        if e.response is not None:
            print(f"Error response: {e.response.text}")
            return jsonify({"error": str(e), "details": e.response.text}), e.response.status_code
        return jsonify({"error": str(e)}), 500

@app.route('/api/create_chat', methods=['POST'])
def create_chat():
    """
    步驟 2 (Agent API): 創建一個新的 Chat session
    """
    try:
        response = requests.post(
            f"{D_ID_API_URL}/agents/{AGENT_ID}/chat",
            headers=common_headers,
            json={} # 請求體為空
        )
        response.raise_for_status()
        chat_data = response.json()
        session['chat_id'] = chat_data.get('id') # 將 chat_id 存儲在 Flask session 中
        return jsonify(chat_data)
    except requests.exceptions.RequestException as e:
        print(f"Error creating chat: {e}")
        if e.response is not None:
            print(f"Error response: {e.response.text}")
            return jsonify({"error": str(e), "details": e.response.text}), e.response.status_code
        return jsonify({"error": str(e)}), 500


@app.route('/api/send_message', methods=['POST'])
def send_message_to_agent():
    """
    步驟 3 (Agent API): 發送消息到 Chat session
    """
    data = request.json
    user_message = data.get('message')
    talk_stream_id = data.get('talk_stream_id')
    talk_session_id = data.get('talk_session_id')

    chat_id = session.get('chat_id')

    if not chat_id:
        return jsonify({"error": "Chat session not created yet. Call /api/create_chat first."}), 400
    if not user_message:
        return jsonify({"error": "Message content is empty"}), 400
    if not talk_stream_id or not talk_session_id:
        return jsonify({"error": "talk_stream_id or talk_session_id is missing"}), 400

    # 獲取當前UTC時間並格式化為 D-ID期望的格式 "MM/DD/YYYY, HH:MM:SS" 紀錄一下好白癡
    # D-ID 的範例是 "03/03/2024, 18:15:00"
    # Python 的 strftime 與此格式對應的是 "%m/%d/%Y, %H:%M:%S"
    created_at_timestamp = datetime.utcnow().strftime("%m/%d/%Y, %H:%M:%S")


    payload = {
        "streamId": talk_stream_id,
        "sessionId": talk_session_id,
        "messages": [
            {
                "role": "user",
                "content": user_message,
                "created_at": created_at_timestamp 
            }
        ]
    }
    try:
        response = requests.post(
            f"{D_ID_API_URL}/agents/{AGENT_ID}/chat/{chat_id}",
            headers=common_headers,
            json=payload
        )
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.RequestException as e:
        print(f"Error sending message to agent: {e}")
        if e.response is not None:
            print(f"Error response: {e.response.text}")
            return jsonify({"error": str(e), "details": e.response.text}), e.response.status_code
        return jsonify({"error": str(e)}), 500
    
@app.route('/api/delete_stream', methods=['POST'])
def delete_stream():
    data = request.json
    stream_id = data.get('stream_id') # 這是 talk_stream_id
    session_id = data.get('session_id') # 這是 talk_session_id

    if not all([stream_id, session_id]):
        return jsonify({"error": "Missing stream_id or session_id"}), 400

    try:
        response = requests.delete(
            f"{D_ID_API_URL}/talks/streams/{stream_id}",
            headers=common_headers,
            json={"session_id": session_id}
        )
        response.raise_for_status()
        return jsonify({"status": "Stream deleted successfully", "details": response.json() if response.content else ""})
    except requests.exceptions.RequestException as e:
        print(f"Error deleting stream: {e}")
        if e.response is not None:
            print(f"Error response: {e.response.text}")
            return jsonify({"error": str(e), "details": e.response.text}), e.response.status_code
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # 記得在生產環境中關閉 debug 模式 真的搞
    # 使用 waitress 或 gunicorn 等 WSGI 服務器部署
    app.run(debug=True, port=5000)