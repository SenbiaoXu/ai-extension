import type { ApiConfig, Message, Tool, ToolCall } from '../types';
import { HarmonyOSApiClient } from '../services/api';
import { DEFAULT_CONFIG } from '../types';
import { getWebSocketClient, type WSMessage, type WSChatPayload, type WSChatResponsePayload, type WSStreamChunkPayload, type WSExternalRequestPayload, type WSExternalResponsePayload } from '../services/websocket';

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
      const payload = message.payload as WSChatPayload;
      await handleWSChat(
        payload.messages,
        payload.config,
        message.id,
        payload.tools,
        payload.tool_choice,
        payload.stream
      );
      return;
    }

    if (message.type === 'external-request') {
      const payload = message.payload as WSExternalRequestPayload;
      chrome.runtime.sendMessage({
        type: 'external-request',
        payload,
      }).catch(() => {});
      return;
    }

    if (message.type === 'external-response') {
      const payload = message.payload as WSExternalResponsePayload;
      chrome.runtime.sendMessage({
        type: 'external-response',
        payload,
      }).catch(() => {});
      return;
    }
  });

  const connected = await wsClient.connect();
  console.log('[BG] WebSocket连接状态:', connected);
}

async function handleWSChat(
  messages: Message[],
  config?: Partial<ApiConfig>,
  messageId?: string,
  tools?: Tool[],
  toolChoice?: WSChatPayload['tool_choice'],
  stream?: boolean
) {
  const apiConfig = { ...await getConfig(), ...config };
  const client = getApiClient(apiConfig);
  const wsClient = getWebSocketClient();
  const useStream = stream !== undefined ? stream : apiConfig.stream;

  try {
    if (useStream) {
      let fullContent = '';
      const toolCallsAccumulator: Map<number, { id: string; type: 'function'; function: { name: string; arguments: string } }> = new Map();
      
      for await (const chunk of client.streamChatCompletion(messages, tools, toolChoice)) {
        if (typeof chunk === 'string') {
          fullContent += chunk;
          wsClient.send({
            type: 'stream-chunk',
            payload: { content: chunk },
            id: messageId,
          });
        } else if (chunk.tool_calls) {
          for (const tc of chunk.tool_calls) {
            const existing = toolCallsAccumulator.get(tc.index) || {
              id: '',
              type: 'function' as const,
              function: { name: '', arguments: '' },
            };
            if (tc.id) existing.id = tc.id;
            if (tc.type) existing.type = tc.type;
            if (tc.function?.name) existing.function.name += tc.function.name;
            if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
            toolCallsAccumulator.set(tc.index, existing);
          }
          wsClient.send({
            type: 'stream-chunk',
            payload: { content: '', tool_calls: chunk.tool_calls },
            id: messageId,
          });
        }
      }
      
      wsClient.send({
        type: 'stream-end',
        id: messageId,
      });
      
      const finalToolCalls = Array.from(toolCallsAccumulator.values()) as ToolCall[];
      wsClient.send({
        type: 'chat-response',
        payload: { 
          content: fullContent || null,
          tool_calls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
        },
        id: messageId,
      });
    } else {
      const response = await client.chatCompletion(messages, tools, toolChoice);
      const choice = response.choices[0];
      wsClient.send({
        type: 'chat-response',
        payload: { 
          content: choice.message.content,
          tool_calls: choice.message.tool_calls,
        },
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
    handleChat(message.messages, message.config, message.tools)
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }

  if (message.type === 'stream-chat') {
    handleStreamChat(message.messages, message.config, message.tools);
    return true;
  }

  if (message.type === 'test-connection') {
    testConnection(message.config)
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }

  if (message.type === 'fetch-models') {
    fetchModels(message.config)
      .then(sendResponse)
      .catch((error) => sendResponse({ success: false, message: error.message }));
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

async function handleChat(messages: Message[], config?: ApiConfig, tools?: Tool[]): Promise<{ content: string | null; tool_calls?: ToolCall[] }> {
  const apiConfig = config || await getConfig();
  const client = getApiClient(apiConfig);
  const response = await client.chatCompletion(messages, tools);
  return { 
    content: response.choices[0].message.content,
    tool_calls: response.choices[0].message.tool_calls,
  };
}

async function handleStreamChat(messages: Message[], config?: ApiConfig, tools?: Tool[]): Promise<void> {
  const apiConfig = config || await getConfig();
  const client = getApiClient(apiConfig);

  try {
    for await (const chunk of client.streamChatCompletion(messages, tools)) {
      if (typeof chunk === 'string') {
        chrome.runtime.sendMessage({ type: 'stream-chunk', content: chunk });
      }
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

async function fetchModels(config: { endpoint: string; apiKey: string }): Promise<{ success: boolean; models?: Array<{ id: string; object: string; created: number; owned_by: string }>; message?: string }> {
  try {
    const client = new HarmonyOSApiClient({
      ...DEFAULT_CONFIG,
      endpoint: config.endpoint,
      apiKey: config.apiKey,
    });
    const response = await client.fetchModels();
    return {
      success: true,
      models: response.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '获取模型列表失败',
    };
  }
}
