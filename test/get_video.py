import requests # pip install requests
import json
import time

D_ID_API_KEY = "撤掉了"
IMAGE_SOURCE_URL = "撤掉了"

# --- 輪詢設定 (沒隔10秒確認DID影片生成進度) ---
POLLING_INTERVAL_SECONDS = 3 # 每隔多少秒檢查一次狀態
TEXT_TO_SPEAK ="哈嘍 哈嘍 哈嘍 哈嘍 你好嗎 "

if __name__ == "__main__":

    # 1. 創建一個 Talk
    create_payload = {
        "source_url": IMAGE_SOURCE_URL,  # 圖片來源網址
        "script": {
        "type": "text",
        "input": TEXT_TO_SPEAK,
        "provider": {  # 語音提供者和類型
            "type": "microsoft",
            "voice_id": "zh-TW-HsiaoChenNeural", 
            "voice_config": {
                "style": "Cheerful"
            }
        }
    },
        "config": { 
            "stitch": True, # 全身串接
            "driver_expressions": { 
                "expressions": [ #  # 表情配置
                    {
                    "start_frame": 0,
                    "expression": "serious", # 有 happy, surprise, neutral ,serious
                    "intensity": 1
                    }
                ]
            }
        }
    }

    # 這裡的 headers 是用來告訴 D-ID API 我們要傳送什麼格式的資料 (也把apikey放進去)
    headers = { 
        "accept": "application/json",
        "content-type": "application/json",
        "authorization": D_ID_API_KEY # 這裡放你的 API KEY
    }

    # 發送 POST 請求到 D-ID API 以創建 Talk  (requests.post (api端點, 內容, 標頭))
    create_response = requests.post("https://api.d-id.com/talks", json=create_payload, headers=headers)
    
    # 把拿到的東東轉成json格式
    response_data = create_response.json()

    # 重拿到的json中取出id
    talk_id = response_data.get("id")

    # 用取出的id來檢查是否成功創建
    if not talk_id:
        print("錯誤：無法從創建回應中獲取 Talk ID。程式終止。")
    else:
        print(f"Talk 創建請求已發送。Talk ID: {talk_id}。開始輪詢狀態...")

        # 2. 輪詢 Talk 的狀態直到完成或失敗
        while True:
            print(f"正在檢查 Talk ID '{talk_id}' 的狀態...")
            get_status_url = f"https://api.d-id.com/talks/{talk_id}"
            status_response = requests.get(get_status_url, headers=headers)
            
            status_data = status_response.json()
            current_status = status_data.get("status")
            
            print(f"目前狀態: {current_status}")

            # 根據狀態進行處理
            # 這裡的狀態可能會有 "created", "started", "done", "error" 等
            # 成功的話會有 "done" 狀態，並且會有影片的下載連結 !!!讚讚
            if current_status == "done":
                video_url = status_data.get("result_url")
                print(f"🎉 影片已生成！下載連結: {video_url}")
                break  # 成功，退出迴圈
            elif current_status == "error":
                error_description = status_data.get("error", "未知錯誤")
                print(f"❌ 影片生成失敗: {error_description}")
                break  # 失敗，退出迴圈
            elif current_status in ["created", "started"]:
                # 影片還在處理中，等待後繼續輪詢
                print(f"影片仍在處理中 ({current_status})。將在 {POLLING_INTERVAL_SECONDS} 秒後再次檢查...")
                time.sleep(POLLING_INTERVAL_SECONDS)
            else:
                # 未知狀態，可能也算是一種錯誤或API變更
                print(f"⚠️ 收到未知的狀態: {current_status}。程式終止。")
                print(f"詳細回應: {json.dumps(status_data, indent=2, ensure_ascii=False)}")
                break

    print("程式執行完畢。")