# 這個檔案會處理 /api/create_stream, /api/start_stream_sdp, /api/send_ice_candidate, /api/delete_stream 的核心邏輯
# 這個檔案專門放跟 D-ID Talks Streams API 打交道的函式，就是處理 WebRTC 影音串流那些複雜玩意兒～

from flask import jsonify # jsonify 是 Flask 用來把 Python 字典轉成 JSON 字串的好幫手
import requests # requests 函式庫，老朋友了，專門用來發 HTTP 請求
import json # json 函式庫，印出複雜資料結構時很有用

def handle_create_stream(d_id_api_url, common_headers, agent_source_url):
    """
    處理 D-ID Talks Streams API 的第一步：創建一個新的 WebRTC stream。
    這個 stream 會跟 AI 角色的影像來源 (source_url) 綁在一起。
    """
    # --- 開始跟 D-ID 說我們要建 WebRTC 串流 ---
    #print(f"DEBUG (did_stream_handlers.py): 準備請求 D-ID 創建一個新的 WebRTC stream，角色影像來源是: {agent_source_url}")
    try:
        response = requests.post(
            f"{d_id_api_url}/talks/streams", # D-ID 創建 stream 的 API 端點
            headers=common_headers, # 通用標頭，裡面有 API Key 那些
            json={"source_url": agent_source_url} # 要告訴 D-ID 影像從哪來
        )
        response.raise_for_status() # 如果 D-ID 不高興，這行會丟出錯誤
        stream_data = response.json() # 把 D-ID 回的 JSON 轉成 Python 字典

        # 印一下 D-ID 給了啥，方便 debug
        #print(f"DEBUG (did_stream_handlers.py): D-ID /talks/streams API 回應的原始資料：")
        print(json.dumps(stream_data, indent=2, ensure_ascii=False))

        # 特別把 id (也就是 talk_stream_id) 跟 session_id (talk_session_id) 拿出來印一下，這兩個超重要
        talk_stream_id_from_did = stream_data.get('id')
        talk_session_id_from_did = stream_data.get('session_id')
        #print(f"DEBUG (did_stream_handlers.py): 從 D-ID 回應中成功提取到 talk_stream_id: {talk_stream_id_from_did}")
        #print(f"DEBUG (did_stream_handlers.py): 從 D-ID 回應中成功提取到 talk_session_id: {talk_session_id_from_did}")

        # stream_data 裡面應該要有 id, session_id, offer (SDP offer), ice_servers 等重要資訊
        return jsonify(stream_data) # 把 D-ID 給的全部資訊回傳給前端
    except requests.exceptions.RequestException as e:
        #print(f"錯誤 (did_stream_handlers.py): 創建 WebRTC stream 時跟 D-ID API 溝通失敗了：{e}")
        if e.response is not None:
            print(f"D-ID 的錯誤回應內容：{e.response.text}")
            return jsonify({"error": str(e), "details": e.response.text}), e.response.status_code
        return jsonify({"error": str(e)}), 500
    # --- 跟 D-ID 說我們要建 WebRTC 串流結束 ---

def handle_start_stream_sdp(d_id_api_url, common_headers, stream_id, session_id, answer_sdp):
    """
    處理 D-ID Talks Streams API 的第二步：把我們這邊 (瀏覽器) 產生的 SDP answer 送給 D-ID。
    stream_id 就是上一步拿到的 talk_stream_id。
    session_id 也是上一步拿到的 talk_session_id。
    """
    # --- 開始把 SDP Answer 丟給 D-ID ---
    #print(f"DEBUG (did_stream_handlers.py): 準備把 SDP Answer 送給 D-ID。Stream ID: {stream_id}, Session ID: {session_id}")
    # print(f"DEBUG (did_stream_handlers.py): 要送的 SDP Answer (部分內容): {str(answer_sdp)[:200]}...") # SDP Answer 通常很長，印一小段就好

    # 檢查一下必要的參數有沒有少給
    if not all([stream_id, session_id, answer_sdp]):
        print(f"錯誤 (did_stream_handlers.py): 送 SDP Answer 時，stream_id ('{stream_id}'), session_id ('{session_id}'), 或 answer_sdp 少了任何一個都不行！")
        return jsonify({"error": "哎呀，stream_id, session_id, 或 SDP answer 沒給完整喔！"}), 400

    try:
        response = requests.post(
            f"{d_id_api_url}/talks/streams/{stream_id}/sdp", # 注意 API 路徑裡有 stream_id
            headers=common_headers,
            json={
                "answer": answer_sdp, # 把前端傳來的 SDP Answer 放進去
                "session_id": session_id # 也要把 talk_session_id 一起送過去
            }
        )
        response.raise_for_status() # 有錯就噴
        # 印一下 D-ID 回應，通常是空的或是一些狀態訊息
        #print(f"DEBUG (did_stream_handlers.py): D-ID 對 SDP Answer 的回應: {response.text if response.content else '回應內容為空'}")
        return jsonify(response.json() if response.content else {"status": "SDP Answer accepted"}) # 如果 D-ID 有回 JSON 就傳，沒有就給個成功狀態
    except requests.exceptions.RequestException as e:
        print(f"錯誤 (did_stream_handlers.py): 送 SDP Answer 給 D-ID 時出包了：{e}")
        if e.response is not None:
            print(f"D-ID 的錯誤回應內容：{e.response.text}")
            return jsonify({"error": str(e), "details": e.response.text}), e.response.status_code
        return jsonify({"error": str(e)}), 500
    # --- 把 SDP Answer 丟給 D-ID 結束 ---

def handle_send_ice_candidate(d_id_api_url, common_headers, stream_id, session_id, candidate_data):
    """
    處理 D-ID Talks Streams API 的第三步：把 WebRTC 的 ICE candidate 送給 D-ID。
    這一步是為了讓雙方能夠找到網路路徑，建立點對點連線。
    """
    # --- 開始把 ICE Candidate 丟給 D-ID ---
    #print(f"DEBUG (did_stream_handlers.py): 準備把 ICE Candidate 送給 D-ID。Stream ID: {stream_id}, Session ID: {session_id}")
    # print(f"DEBUG (did_stream_handlers.py): ICE Candidate 資料: {candidate_data}")

    # 檢查參數
    if not all([stream_id, session_id, candidate_data]):
        print(f"錯誤 (did_stream_handlers.py): 送 ICE Candidate 時，stream_id ('{stream_id}'), session_id ('{session_id}'), 或 candidate_data 少了都不行！")
        return jsonify({"error": "喂～ stream_id, session_id, 或 ICE candidate 資料沒給齊喔！"}), 400

    # D-ID 期望的 payload 格式
    payload = {
        "candidate": candidate_data.get("candidate"),
        "sdpMid": candidate_data.get("sdpMid"),
        "sdpMLineIndex": candidate_data.get("sdpMLineIndex"),
        "session_id": session_id # talk_session_id 也要帶上
    }
    print(f"DEBUG (did_stream_handlers.py): 要送給 D-ID 的 ICE Candidate payload: {json.dumps(payload, indent=2)}")

    try:
        response = requests.post(
            f"{d_id_api_url}/talks/streams/{stream_id}/ice", # 注意 API 路徑
            headers=common_headers,
            json=payload
        )
        response.raise_for_status()
        # D-ID 通常回一個空的回應或簡單的狀態
        #print(f"DEBUG (did_stream_handlers.py): D-ID 對 ICE Candidate 的回應: {response.text if response.content else '回應內容為空'}")
        return jsonify(response.json() if response.content else {"status": "ICE candidate accepted"})
    except requests.exceptions.RequestException as e:
        print(f"錯誤 (did_stream_handlers.py): 送 ICE Candidate 給 D-ID 時GG了：{e}")
        if e.response is not None:
            print(f"D-ID 的錯誤回應內容：{e.response.text}")
            return jsonify({"error": str(e), "details": e.response.text}), e.response.status_code
        return jsonify({"error": str(e)}), 500
    # --- 把 ICE Candidate 丟給 D-ID 結束 ---

def handle_delete_stream(d_id_api_url, common_headers, stream_id, session_id):
    """
    處理 D-ID Talks Streams API 的最後一步 (可選)：當串流結束時，通知 D-ID 刪除這個 stream。
    """
    # --- 開始跟 D-ID 說我們要刪掉 WebRTC 串流 ---
    #print(f"DEBUG (did_stream_handlers.py): 準備請求 D-ID 刪除 WebRTC Stream。Stream ID: {stream_id}, Session ID: {session_id}")

    if not all([stream_id, session_id]):
        print(f"錯誤 (did_stream_handlers.py): 刪除 Stream 時，stream_id ('{stream_id}') 或 session_id ('{session_id}') 不能少！")
        return jsonify({"error": "要刪除 Stream，結果 stream_id 或 session_id 不見了？"}), 400

    try:
        response = requests.delete(
            f"{d_id_api_url}/talks/streams/{stream_id}", # DELETE 請求
            headers=common_headers,
            json={"session_id": session_id} # Body 裡面要放 session_id (talk_session_id)
        )
        response.raise_for_status()
        # D-ID 的回應
        response_details = response.json() if response.content else ""
        #print(f"DEBUG (did_stream_handlers.py): D-ID 對刪除 Stream 的回應: {response_details if response_details else '回應內容為空'}")
        return jsonify({"status": "Stream deleted successfully", "details": response_details})
    except requests.exceptions.RequestException as e:
        print(f"錯誤 (did_stream_handlers.py): 刪除 Stream 時跟 D-ID API 溝通失敗：{e}")
        if e.response is not None:
            print(f"D-ID 的錯誤回應內容：{e.response.text}")
            return jsonify({"error": str(e), "details": e.response.text}), e.response.status_code
        return jsonify({"error": str(e)}), 500
    # --- 跟 D-ID 說我們要刪掉 WebRTC 串流結束 ---