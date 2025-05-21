from flask import Flask, render_template, request, jsonify
import requests
import time

app = Flask(__name__)
app.secret_key = "a_very_simple_secret_key"

# D-ID API 設定 (學生需替換成自己的金鑰和圖片URL)
D_ID_API_KEY = "Basic cWluZ2Z1bWFpbmFvQGdtYWlsLmNvbQ:ictjs-IWq61RcPABpK-tY"
CHARACTER_IMAGE_SOURCE_URL = "https://create-images-results.d-id.com/google-oauth2|110694817992140356574/upl_vx3RG0IVzRCgvrKcALxRa/image.png" # 例如：一個公開的圖片URL

D_ID_TALKS_API_URL = "https://api.d-id.com/talks"
POLLING_INTERVAL_SECONDS = 3

# --- 基本頁面路由 ---
@app.route('/')
def home_page():
    return render_template('page1/index.html')

@app.route('/page1')
def page1_route():
    return render_template('page1/index.html')

@app.route('/page2')
def page2_route():
    return render_template('page2/page2.html')

@app.route('/page3')
def page3_route():
    return render_template('page3/page3.html')

@app.route('/page4')
def page4_route():
    return render_template('page4/page4.html')
# --- 基本頁面路由結束 ---

# --- API 路由：用於 D-ID Talk 生成 ---
@app.route('/api/generate_talk', methods=['POST'])
def generate_talk():
    data = request.get_json()
    text_to_speak = data.get('text')

    if not text_to_speak:
        return jsonify({"error": "沒有提供文字"}), 400 # 雖然說不要錯誤判斷，但這個還是基本要有

    create_payload = {
        "source_url": CHARACTER_IMAGE_SOURCE_URL,
        "script": {
            "type": "text",
            "input": text_to_speak,
            "provider": {
                "type": "microsoft",
                "voice_id": "zh-TW-HsiaoChenNeural", # 可以讓學生嘗試不同語音
            }
        },
        "config": {"stitch": True}
    }

    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "authorization": D_ID_API_KEY
    }

    # 步驟 1: 創建 Talk
    create_response = requests.post(D_ID_TALKS_API_URL, json=create_payload, headers=headers)
    if create_response.status_code != 201: # D-ID 創建成功是 201
        print(f"D-ID Create Talk API 錯誤: {create_response.status_code} - {create_response.text}")
        return jsonify({"error": "D-ID 創建 Talk 失敗", "details": create_response.text}), create_response.status_code
    
    response_data = create_response.json()
    talk_id = response_data.get("id")
    print(f"Talk 創建成功，ID: {talk_id}")

    # 步驟 2: 輪詢 Talk 狀態
    while True:
        get_status_url = f"{D_ID_TALKS_API_URL}/{talk_id}"
        status_response = requests.get(get_status_url, headers=headers)
        if status_response.status_code != 200:
            print(f"D-ID Get Talk Status API 錯誤: {status_response.status_code} - {status_response.text}")
            return jsonify({"error": "D-ID 獲取狀態失敗", "details": status_response.text}), status_response.status_code

        status_data = status_response.json()
        current_status = status_data.get("status")
        print(f"Talk ID {talk_id} 目前狀態: {current_status}")

        if current_status == "done":
            video_url = status_data.get("result_url")
            print(f"影片生成完成！URL: {video_url}")
            return jsonify({"video_url": video_url, "status": "success"})
        elif current_status == "error":
            print(f"D-ID 影片生成錯誤: {status_data.get('error')}")
            return jsonify({"error": "D-ID 影片生成失敗", "details": status_data.get('error')}), 500
        
        time.sleep(POLLING_INTERVAL_SECONDS)

if __name__ == '__main__':
    app.run(debug=True, port=5000)