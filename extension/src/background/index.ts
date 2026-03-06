import type { ApiConfig, Message } from '../types';
import { HarmonyOSApiClient } from '../services/api';
import { DEFAULT_CONFIG } from '../types';

let apiClient: HarmonyOSApiClient | null = null;

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

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

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
