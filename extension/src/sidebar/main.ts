import type { Message, ApiConfig } from '../types';
import { DEFAULT_CONFIG } from '../types';
import { loadConfig } from '../services/storage';

class ChatApp {
  private messages: Message[] = [];
  private config: ApiConfig = DEFAULT_CONFIG;
  private isStreaming = false;
  private currentAssistantContent = '';

  private messagesContainer!: HTMLElement;
  private messageInput!: HTMLTextAreaElement;
  private sendButton!: HTMLButtonElement;
  private welcomeMessage!: HTMLElement;
  private connectionStatus!: HTMLElement;

  async init() {
    this.messagesContainer = document.getElementById('messages')!;
    this.messageInput = document.getElementById('message-input') as HTMLTextAreaElement;
    this.sendButton = document.getElementById('send-btn') as HTMLButtonElement;
    this.welcomeMessage = document.getElementById('welcome-message')!;
    this.connectionStatus = document.getElementById('connection-status')!;

    await this.loadConfiguration();
    this.bindEvents();
    this.testConnection();
  }

  private async loadConfiguration() {
    this.config = await loadConfig<ApiConfig>(DEFAULT_CONFIG);
  }

  private bindEvents() {
    this.sendButton.addEventListener('click', () => this.sendMessage());

    this.messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    this.messageInput.addEventListener('input', () => {
      this.messageInput.style.height = 'auto';
      this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
    });

    document.querySelectorAll('.quick-action-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const prompt = (e.currentTarget as HTMLElement).dataset.prompt;
        if (prompt) {
          this.messageInput.value = prompt;
          this.sendMessage();
        }
      });
    });

    document.getElementById('settings-btn')?.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'stream-chunk') {
        this.handleStreamChunk(message.content);
      } else if (message.type === 'stream-end') {
        this.handleStreamEnd();
      } else if (message.type === 'stream-error') {
        this.handleStreamError(message.error);
      }
    });
  }

  private async testConnection() {
    this.updateConnectionStatus('connecting');
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'test-connection',
        config: this.config,
      });
      if (response.success) {
        this.updateConnectionStatus('connected');
      } else {
        this.updateConnectionStatus('error');
      }
    } catch {
      this.updateConnectionStatus('error');
    }
  }

  private updateConnectionStatus(status: 'connecting' | 'connected' | 'error') {
    const statusText = this.connectionStatus.querySelector('.status-text')!;
    this.connectionStatus.className = `status-indicator ${status}`;

    switch (status) {
      case 'connecting':
        statusText.textContent = '连接中...';
        break;
      case 'connected':
        statusText.textContent = '已连接';
        break;
      case 'error':
        statusText.textContent = '连接失败';
        break;
    }
  }

  private async sendMessage() {
    const content = this.messageInput.value.trim();
    if (!content || this.isStreaming) return;

    this.welcomeMessage.style.display = 'none';
    this.messageInput.value = '';
    this.messageInput.style.height = 'auto';

    const userMessage: Message = { role: 'user', content };
    this.messages.push(userMessage);
    this.renderMessage(userMessage);

    this.isStreaming = true;
    this.sendButton.disabled = true;
    this.currentAssistantContent = '';

    this.renderTypingIndicator();

    if (this.config.stream) {
      await this.streamChat();
    } else {
      await this.normalChat();
    }
  }

  private async streamChat() {
    try {
      await chrome.runtime.sendMessage({
        type: 'stream-chat',
        messages: this.messages,
        config: this.config,
      });
    } catch (error) {
      this.handleStreamError(error instanceof Error ? error.message : '发送失败');
    }
  }

  private async normalChat() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'chat',
        messages: this.messages,
        config: this.config,
      });

      if (response.error) {
        this.handleStreamError(response.error);
        return;
      }

      const assistantMessage: Message = { role: 'assistant', content: response.content };
      this.messages.push(assistantMessage);
      this.removeTypingIndicator();
      this.renderMessage(assistantMessage);
      this.isStreaming = false;
      this.sendButton.disabled = false;
    } catch (error) {
      this.handleStreamError(error instanceof Error ? error.message : '发送失败');
    }
  }

  private handleStreamChunk(content: string) {
    this.currentAssistantContent += content;
    this.updateStreamingMessage(this.currentAssistantContent);
  }

  private handleStreamEnd() {
    const assistantMessage: Message = {
      role: 'assistant',
      content: this.currentAssistantContent,
    };
    this.messages.push(assistantMessage);
    this.removeTypingIndicator();
    this.renderMessage(assistantMessage);
    this.isStreaming = false;
    this.sendButton.disabled = false;
  }

  private handleStreamError(error: string) {
    this.removeTypingIndicator();
    this.renderError(error);
    this.isStreaming = false;
    this.sendButton.disabled = false;
  }

  private renderMessage(message: Message) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${message.role}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = message.role === 'user' ? '👤' : '🤖';

    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = message.content;

    messageEl.appendChild(avatar);
    messageEl.appendChild(content);
    this.messagesContainer.appendChild(messageEl);

    this.scrollToBottom();
  }

  private renderTypingIndicator() {
    const typingEl = document.createElement('div');
    typingEl.className = 'message assistant';
    typingEl.id = 'typing-indicator';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '🤖';

    const content = document.createElement('div');
    content.className = 'message-content';
    content.id = 'streaming-content';

    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';

    content.appendChild(indicator);
    typingEl.appendChild(avatar);
    typingEl.appendChild(content);
    this.messagesContainer.appendChild(typingEl);

    this.scrollToBottom();
  }

  private updateStreamingMessage(content: string) {
    const streamingContent = document.getElementById('streaming-content');
    if (streamingContent) {
      streamingContent.textContent = content;
    }
    this.scrollToBottom();
  }

  private removeTypingIndicator() {
    const typingEl = document.getElementById('typing-indicator');
    if (typingEl) {
      typingEl.remove();
    }
  }

  private renderError(error: string) {
    const errorEl = document.createElement('div');
    errorEl.className = 'error-message';
    errorEl.textContent = `错误: ${error}`;
    this.messagesContainer.appendChild(errorEl);
    this.scrollToBottom();
  }

  private scrollToBottom() {
    const container = document.getElementById('chat-container');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new ChatApp();
  app.init();
});
