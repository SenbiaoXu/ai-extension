import type { Conversation, Message } from '../types';

const STORAGE_KEYS = {
  CONFIG: 'harmonyos_ai_config',
  CONVERSATIONS: 'harmonyos_ai_conversations',
  CURRENT_CONVERSATION: 'harmonyos_ai_current_conversation',
};

export async function saveConfig(config: unknown): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.CONFIG]: config });
}

export async function loadConfig<T>(defaultValue: T): Promise<T> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CONFIG);
  return result[STORAGE_KEYS.CONFIG] || defaultValue;
}

export async function saveConversations(conversations: Conversation[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.CONVERSATIONS]: conversations });
}

export async function loadConversations(): Promise<Conversation[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CONVERSATIONS);
  return result[STORAGE_KEYS.CONVERSATIONS] || [];
}

export async function saveCurrentConversationId(id: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.CURRENT_CONVERSATION]: id });
}

export async function loadCurrentConversationId(): Promise<string | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CURRENT_CONVERSATION);
  return result[STORAGE_KEYS.CURRENT_CONVERSATION] || null;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function createNewConversation(firstMessage?: string): Conversation {
  const now = Date.now();
  return {
    id: generateId(),
    title: firstMessage ? firstMessage.slice(0, 30) : '新对话',
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function updateConversationTitle(conversation: Conversation, messages: Message[]): Conversation {
  if (messages.length > 0 && messages[0].role === 'user') {
    const firstUserMessage = messages[0].content;
    if (firstUserMessage) {
      conversation.title = firstUserMessage.slice(0, 30) + (firstUserMessage.length > 30 ? '...' : '');
    }
  }
  conversation.updatedAt = Date.now();
  return conversation;
}
