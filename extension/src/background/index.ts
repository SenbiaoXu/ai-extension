import type { ApiConfig, Message } from '../types';
import { HarmonyOSApiClient } from '../services/api';
import { DEFAULT_CONFIG } from '../types';
import { getWebSocketClient, type WSMessage } from '../services/websocket';

let apiClient: HarmonyOSApiClient | null = null;
let wsConnected = false;

function getApiClient(config: ApiConfig): HarmonyOSApiClient {
  if (!apiClient) {
    apiClient = new HarmonyOSApiClient(config);
  } else {
    apiClient.updateConfig(config);
  }
  return apiClient;
}

async function getConfig(): Promise<ApiConfig> {
  const result = await chrome.storage.local.get('harmonyos_ai_config');
  return { ...DEFAULT_CONFIG, ...result.harmonyos_ai_config };
}

async function initWebSocket() {
  const wsClient = getWebSocketClient();
  
  wsClient.onConnectionChange((connected) => {
    wsConnected = connected;
    console.log('[BG] WebSocket连接状态变化:', connected);
  });

  wsClient.onMessage(async (message: WSMessage) => {
    console.log('[BG] 收到WebSocket消息:', message.type);
    
    if (message.type === 'connected') {
      wsConnected = true;
      console.log('[BG] WebSocket已连接');
      return;
    }

    if (message.type === 'chat') {
      const payload = message.payload as { messages: Message[]; config?: Partial<ApiConfig> };
      await handleWSChat(payload.messages, payload.config, message.id);
    }
  });

  const connected = await wsClient.connect();
  console.log('[BG] WebSocket连接状态:', connected);
}

async function handleWSChat(messages: Message[], config?: Partial<ApiConfig>, messageId?: string) {
  const apiConfig = { ...await getConfig(), ...config };
  const client = getApiClient(apiConfig);
  const wsClient = getWebSocketClient();

  try {
    if (apiConfig.stream) {
      let fullContent = '';
      for await (const chunk of client.streamChatCompletion(messages)) {
        fullContent += chunk;
        wsClient.send({
          type: 'stream-chunk',
          payload: { content: chunk },
          id: messageId,
        });
      }
      wsClient.send({
        type: 'stream-end',
        id: messageId,
      });
      wsClient.send({
        type: 'chat-response',
        payload: { content: fullContent },
        id: messageId,
      });
    } else {
      const response = await client.chatCompletion(messages);
      const content = response.choices[0].message.content;
      wsClient.send({
        type: 'chat-response',
        payload: { content },
        id: messageId,
      });
    }
  } catch (error) {
    wsClient.send({
      type: 'stream-error',
      payload: { message: error instanceof Error ? error.message : '未知错误' },
      id: messageId,
    });
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onStartup.addListener(() => {
  initWebSocket();
});

chrome.runtime.onInstalled.addListener(() => {
  initWebSocket();
});

initWebSocket();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'chat') {
    handleChat(message.messages, message.config)
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }

  if (message.type === 'stream-chat') {
    handleStreamChat(message.messages, message.config);
    return true;
  }

  if (message.type === 'test-connection') {
    testConnection(message.config)
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }

  if (message.type === 'ws-connect') {
    initWebSocket()
      .then(() => sendResponse({ success: wsConnected }))
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }

  if (message.type === 'ws-status') {
    sendResponse({ connected: wsConnected });
    return true;
  }

  if (message.type === 'ws-send-chat') {
    const wsClient = getWebSocketClient();
    wsClient.send({
      type: 'chat',
      payload: { messages: message.messages, config: message.config },
    });
    sendResponse({ success: true });
    return true;
  }

  return false;
});

async function handleChat(messages: Message[], config?: ApiConfig): Promise<{ content: string }> {
  const apiConfig = config || await getConfig();
  const client = getApiClient(apiConfig);
  const response = await client.chatCompletion(messages);
  return { content: response.choices[0].message.content };
}

async function handleStreamChat(messages: Message[], config?: ApiConfig): Promise<void> {
  const apiConfig = config || await getConfig();
  const client = getApiClient(apiConfig);

  try {
    for await (const chunk of client.streamChatCompletion(messages)) {
      chrome.runtime.sendMessage({ type: 'stream-chunk', content: chunk });
    }
    chrome.runtime.sendMessage({ type: 'stream-end' });
  } catch (error) {
    chrome.runtime.sendMessage({
      type: 'stream-error',
      error: error instanceof Error ? error.message : '未知错误',
    });
  }
}

async function testConnection(config?: ApiConfig): Promise<{ success: boolean; message: string }> {
  const apiConfig = config || await getConfig();
  const client = getApiClient(apiConfig);
  const success = await client.testConnection();
  return {
    success,
    message: success ? '连接成功' : '连接失败，请检查API端点配置',
  };
}
