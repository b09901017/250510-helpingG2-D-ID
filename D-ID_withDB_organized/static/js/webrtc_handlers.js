// webrtc_handlers.js
// 專門處理 WebRTC (RTCPeerConnection) 的所有鳥事
// 建立連線、設定事件監聽、處理媒體串流等等

// --- 全域變數或狀態 通常由 main.js 管理並傳入 ---
// let peerConnection // RTCPeerConnection 實例
// let talkStreamId   // D-ID 的 stream ID
// let talkSessionId  // D-ID 的 stream session ID
// let iceServersList // D-ID 給的 ICE server 列表

// --- DOM 元素 通常由 main.js 管理並傳入 ---
// let agentVideoElement
// let connectionStatusElement
// let errorMessageElement
// let unMuteButtonElement

// --- API 處理函式 通常從 api_handlers.js 引入或由 main.js 傳入 ---
// let sendIceCandidateFunc

function createPeerConnection(
    currentIceServers,
    currentTalkStreamId,
    currentTalkSessionId,
    onIceCandidateCallback, // 當收集到 ICE candidate 時要呼叫的函式 (通常是 callSendIceCandidateAPI)
    onTrackCallback,        // 當收到遠端媒體軌道時要呼叫的函式
    onIceConnectionStateChangeCallback, // ICE 連線狀態改變時的 callback
    onConnectionStateChangeCallback,    // WebRTC 整體連線狀態改變時的 callback
    onDataChannelMessageCallback,       // Data channel 收到訊息時的 callback
    onDataChannelOpenCallback,          // Data channel 開啟時的 callback
    onDataChannelCloseCallback,         // Data channel 關閉時的 callback
    onDataChannelErrorCallback          // Data channel 發生錯誤時的 callback
) {
    // 建立並設定 RTCPeerConnection
    console.log('webrtc_handlers.js: 準備建立新的 RTCPeerConnection 設定 ICE servers:', currentIceServers)
    const pc = new RTCPeerConnection({ iceServers: currentIceServers })

    // --- 設定 Data Channel ---
    // D-ID 似乎是用 data channel 來傳遞文字訊息跟控制事件
    const dataChannel = pc.createDataChannel('JanusDataChannel') // 名稱可以自訂 D-ID 範例常用這個
    console.log('webrtc_handlers.js: Data Channel ("JanusDataChannel") 已建立')

    dataChannel.onopen = () => {
        console.log('webrtc_handlers.js: Data Channel 已成功開啟 (onopen)')
        if (onDataChannelOpenCallback) onDataChannelOpenCallback()
    }

    dataChannel.onclose = () => {
        console.log('webrtc_handlers.js: Data Channel 已關閉 (onclose)')
        if (onDataChannelCloseCallback) onDataChannelCloseCallback()
    }

    dataChannel.onerror = (error) => {
        console.error('webrtc_handlers.js: Data Channel 發生錯誤 (onerror):', error)
        if (onDataChannelErrorCallback) onDataChannelErrorCallback(error)
    }

    dataChannel.onmessage = (event) => {
        // console.log('webrtc_handlers.js: Data Channel 收到訊息 (onmessage):', event.data) // 太頻繁 先關掉
        if (onDataChannelMessageCallback) onDataChannelMessageCallback(event.data)
    }
    // --- Data Channel 設定結束 ---

    // --- 設定 PeerConnection 的事件監聽 ---
    pc.addEventListener('icecandidate', async (event) => {
        if (event.candidate) {
            //console.log('webrtc_handlers.js: 收集到新的 ICE candidate:', event.candidate)
            // 把 candidate sdpMid sdpMLineIndex 包起來 透過 callback (通常是 callSendIceCandidateAPI) 送給後端
            if (onIceCandidateCallback) {
                onIceCandidateCallback(currentTalkStreamId, currentTalkSessionId, event.candidate)
            }
        } else {
            console.log('webrtc_handlers.js: 所有 ICE candidates 都收集完畢了 (event.candidate is null)')
        }
    })

    pc.addEventListener('iceconnectionstatechange', () => {
        console.log(`webrtc_handlers.js: ICE 連線狀態改變: ${pc.iceConnectionState}`)
        if (onIceConnectionStateChangeCallback) {
            onIceConnectionStateChangeCallback(pc.iceConnectionState)
        }
    })

    pc.addEventListener('connectionstatechange', () => {
        console.log(`webrtc_handlers.js: WebRTC 整體連線狀態改變: ${pc.connectionState}`)
        if (onConnectionStateChangeCallback) {
            onConnectionStateChangeCallback(pc.connectionState)
        }
    })

    pc.addEventListener('track', (event) => {
        console.log(`webrtc_handlers.js: 收到遠端的媒體軌道 (track)! 類型: ${event.track.kind} ID: ${event.track.id}`)
        if (onTrackCallback) {
            onTrackCallback(event)
        }
    })
    // --- PeerConnection 事件監聽設定結束 ---

    return pc // 把建立好的 peerConnection 物件還回去
}

async function setupAndStartWebRTC(
    peerConnectionInstance,
    sdpOfferFromDid, // 從 /api/create_stream 拿到的 D-ID SDP Offer
    startStreamSdpApiFunc // 用來呼叫 /api/start_stream_sdp 的函式
    // streamId, sessionId 會在 startStreamSdpApiFunc 內部處理 這裡不用再傳
) {
    // 設定遠端描述 (D-ID的Offer) 產生本地 Answer 並送出
    if (!peerConnectionInstance) {
        console.error('webrtc_handlers.js: setupAndStartWebRTC 失敗 peerConnectionInstance 是 null')
        throw new Error('PeerConnection 尚未初始化')
    }
    if (!sdpOfferFromDid) {
        console.error('webrtc_handlers.js: setupAndStartWebRTC 失敗 D-ID 的 SDP Offer 是空的')
        throw new Error('D-ID 的 SDP Offer 未提供')
    }

    console.log('webrtc_handlers.js: 準備設定遠端描述 (D-ID 的 Offer)')
    // console.log('D-ID Offer (部分):', JSON.stringify(sdpOfferFromDid).substring(0, 200))
    await peerConnectionInstance.setRemoteDescription(new RTCSessionDescription(sdpOfferFromDid))
    console.log('webrtc_handlers.js: 遠端描述設定完成 準備產生本地 Answer')

    const localSdpAnswer = await peerConnectionInstance.createAnswer()
    console.log('webrtc_handlers.js: 本地 Answer 產生完成 準備設定本地描述')
    // console.log('本地 Answer (部分):', JSON.stringify(localSdpAnswer).substring(0, 200))
    await peerConnectionInstance.setLocalDescription(localSdpAnswer)
    console.log('webrtc_handlers.js: 本地描述設定完成 準備透過 API 發送 Answer 給 D-ID')

    // 把產生好的 SDP Answer 透過 API 送給 D-ID
    // startStreamSdpApiFunc 應該是 api_handlers.js 裡的 callStartStreamSdpAPI
    // 它需要 stream_id, session_id, sdpAnswer
    // 這表示呼叫 setupAndStartWebRTC 的地方 (例如 main.js) 需要把 talkStreamId 和 talkSessionId 傳給 startStreamSdpApiFunc
    // 或者讓 startStreamSdpApiFunc 在其閉包中可以訪問到這些ID
    // 這裡假設 startStreamSdpApiFunc 會自行處理 ID 的傳遞 (它會接收 talkStreamId, talkSessionId)
    await startStreamSdpApiFunc(localSdpAnswer) // startStreamSdpApiFunc 應已綁定 streamId sessionId

    console.log('webrtc_handlers.js: SDP Answer 已成功發送給 D-ID WebRTC 設定流程算是告一段落 等待連線成功')
}

function handleRemoteTrack(event, agentVideoElement, unMuteButtonElement, errorDisplayFunc, toggleUnmuteButtonFunc) {
    // 處理 'track' 事件 把遠端媒體流附加到 video 元素上
    console.log(`webrtc_handlers.js: handleRemoteTrack - 收到軌道 event.track.kind=${event.track.kind}`)
    const remoteStream = event.streams && event.streams[0]

    if (remoteStream) {
        if (agentVideoElement.srcObject !== remoteStream) {
            console.log('webrtc_handlers.js: 分配新的遠端媒體流給 video 元素 srcObject')
            agentVideoElement.srcObject = remoteStream
            agentVideoElement.play()
                .then(() => {
                    console.log('webrtc_handlers.js: 遠端視訊成功開始播放')
                    if (agentVideoElement.muted && toggleUnmuteButtonFunc) {
                        toggleUnmuteButtonFunc(unMuteButtonElement, agentVideoElement, true) // 顯示 Unmute 按鈕
                    }
                })
                .catch(e => {
                    console.error('webrtc_handlers.js: 遠端視訊播放失敗:', e)
                    if (errorDisplayFunc) errorDisplayFunc(`遠端視訊播放失敗: ${e.name} - ${e.message}`)
                    // 如果是 NotAllowedError 代表瀏覽器可能因為沒靜音而阻止自動播放
                    if (e.name === 'NotAllowedError' && toggleUnmuteButtonFunc) {
                         // 確保即使播放失敗 Unmute 按鈕還是會根據 muted 狀態顯示
                        toggleUnmuteButtonFunc(unMuteButtonElement, agentVideoElement, true)
                    }
                })
        } else {
            console.log('webrtc_handlers.js: 接收到的媒體流跟目前的一樣 不重新分配')
        }
    } else if (event.track) { // 處理沒有 event.streams 但有 event.track 的情況 (備用)
        console.warn('webrtc_handlers.js: 收到 track 事件但 event.streams 為空 嘗試使用 event.track')
        let currentSrcObject = agentVideoElement.srcObject
        if (currentSrcObject instanceof MediaStream) {
            if (!currentSrcObject.getTracks().includes(event.track)) {
                console.log('webrtc_handlers.js: 將新的 track 加入現有的 MediaStream')
                currentSrcObject.addTrack(event.track)
            }
        } else {
            console.log('webrtc_handlers.js: video 元素沒有 srcObject 或不是 MediaStream 創建新的 MediaStream')
            let newStream = new MediaStream()
            newStream.addTrack(event.track)
            agentVideoElement.srcObject = newStream
        }
        // 即使只加 track 也嘗試播放
        if (agentVideoElement.paused && agentVideoElement.readyState >= HTMLMediaElement.HAVE_METADATA) {
            agentVideoElement.play().catch(e => {
                console.error('webrtc_handlers.js: 播放錯誤 (track fallback):', e)
                if (errorDisplayFunc) errorDisplayFunc(`播放錯誤 (track fallback): ${e.name} - ${e.message}`)
            })
        }
    } else {
        console.warn('webrtc_handlers.js: 收到 track 事件但 event.streams 和 event.track 都沒有東西 怪怪的')
    }
}

function closePeerConnection(pcInstance) {
    // 關閉 RTCPeerConnection
    if (pcInstance) {
        // 關閉所有 DataChannel
        // pcInstance.getSenders().forEach(sender => {
        //     if (sender.track && sender.track.kind === 'application') { // DataChannel 在 Chrome 中 kind 是 application
        //         // 如何正確關閉 DataChannel? pc.close() 應該會處理
        //     }
        // });
        pcInstance.close()
        console.log('webrtc_handlers.js: RTCPeerConnection 已關閉')
        return null // 返回 null 讓外部變數可以更新
    }
    return pcInstance // 如果本來就是 null 就返回 null
}


// --- WebRTC 處理函式結束 ---