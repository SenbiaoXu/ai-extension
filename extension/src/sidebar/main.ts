import type { Message, ApiConfig, Tool } from '../types';
import { DEFAULT_CONFIG } from '../types';
import { loadConfig } from '../services/storage';

interface ExternalMessage {
  requestId: string;
  model: string;
  messages: Array<{ role: string; content: string | null }>;
  stream: boolean;
  timestamp: number;
  status: 'pending' | 'success' | 'error' | 'timeout';
  responseContent?: string | null;
  error?: string;
  duration?: number;
}

class ChatApp {
  private messages: Message[] = [];
  private config: ApiConfig = DEFAULT_CONFIG;
  private isStreaming = false;
  private currentAssistantContent = '';
  private currentTools: Tool[] | undefined;
  private externalMessages: ExternalMessage[] = [];
  private unreadCount = 0;
  private isPanelOpen = false;

  private messagesContainer!: HTMLElement;
  private messageInput!: HTMLTextAreaElement;
  private sendButton!: HTMLButtonElement;
  private welcomeMessage!: HTMLElement;
  private connectionStatus!: HTMLElement;
  private externalMsgBtn!: HTMLButtonElement;
  private msgBadge!: HTMLElement;
  private externalMsgPanel!: HTMLElement;
  private externalMsgList!: HTMLElement;

  async init() {
    this.messagesContainer = document.getElementById('messages')!;
    this.messageInput = document.getElementById('message-input') as HTMLTextAreaElement;
    this.sendButton = document.getElementById('send-btn') as HTMLButtonElement;
    this.welcomeMessage = document.getElementById('welcome-message')!;
    this.connectionStatus = document.getElementById('connection-status')!;
    this.externalMsgBtn = document.getElementById('external-msg-btn') as HTMLButtonElement;
    this.msgBadge = document.getElementById('msg-badge')!;
    this.externalMsgPanel = document.getElementById('external-msg-panel')!;
    this.externalMsgList = document.getElementById('external-msg-list')!;

    await this.loadConfiguration();
    this.bindEvents();
    this.testConnection();
  }

  private async loadConfiguration() {
    this.config = await loadConfig<ApiConfig>(DEFAULT_CONFIG);
  }

  private hasValidConfig(): boolean {
    return !!(this.config.endpoint && this.config.model);
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
        const toolsJson = (e.currentTarget as HTMLElement).dataset.tools;
        if (prompt) {
          this.messageInput.value = prompt;
          this.currentTools = toolsJson ? JSON.parse(toolsJson) : undefined;
          this.sendMessage();
        }
      });
    });

    document.getElementById('settings-btn')?.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    this.externalMsgBtn.addEventListener('click', () => {
      this.toggleExternalMsgPanel();
    });

    document.getElementById('close-panel-btn')?.addEventListener('click', () => {
      this.closeExternalMsgPanel();
    });

    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'stream-chunk') {
        this.handleStreamChunk(message.content);
      } else if (message.type === 'stream-end') {
        this.handleStreamEnd();
      } else if (message.type === 'stream-error') {
        this.handleStreamError(message.error);
      } else if (message.type === 'external-request') {
        this.handleExternalRequest(message.payload);
      } else if (message.type === 'external-response') {
        this.handleExternalResponse(message.payload);
      }
    });
  }

  private async testConnection() {
    if (!this.config.endpoint) {
      this.updateConnectionStatus('error');
      return;
    }
    
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

    if (!this.hasValidConfig()) {
      this.renderError('请先在设置中配置API端点并选择模型');
      return;
    }

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

    const tools = this.currentTools;
    this.currentTools = undefined;

    if (this.config.stream) {
      await this.streamChat(tools);
    } else {
      await this.normalChat(tools);
    }
  }

  private async streamChat(tools?: Tool[]) {
    try {
      await chrome.runtime.sendMessage({
        type: 'stream-chat',
        messages: this.messages,
        config: this.config,
        tools,
      });
    } catch (error) {
      this.handleStreamError(error instanceof Error ? error.message : '发送失败');
    }
  }

  private async normalChat(tools?: Tool[]) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'chat',
        messages: this.messages,
        config: this.config,
        tools,
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

  private handleExternalRequest(payload: { requestId: string; model: string; messages: Array<{ role: string; content: string | null }>; stream: boolean; timestamp: number }) {
    const msg: ExternalMessage = {
      requestId: payload.requestId,
      model: payload.model,
      messages: payload.messages,
      stream: payload.stream,
      timestamp: payload.timestamp,
      status: 'pending',
    };
    
    this.externalMessages.unshift(msg);
    this.unreadCount++;
    this.updateBadge();
    this.renderExternalMessages();
  }

  private handleExternalResponse(payload: { requestId: string; status: 'success' | 'error' | 'timeout'; content?: string | null; error?: string; duration: number; timestamp: number }) {
    const msgIndex = this.externalMessages.findIndex(m => m.requestId === payload.requestId);
    if (msgIndex !== -1) {
      this.externalMessages[msgIndex].status = payload.status;
      this.externalMessages[msgIndex].responseContent = payload.content;
      this.externalMessages[msgIndex].error = payload.error;
      this.externalMessages[msgIndex].duration = payload.duration;
      this.renderExternalMessages();
    }
  }

  private toggleExternalMsgPanel() {
    if (this.isPanelOpen) {
      this.closeExternalMsgPanel();
    } else {
      this.openExternalMsgPanel();
    }
  }

  private openExternalMsgPanel() {
    this.isPanelOpen = true;
    this.externalMsgPanel.classList.remove('hidden');
    this.clearUnread();
  }

  private closeExternalMsgPanel() {
    this.isPanelOpen = false;
    this.externalMsgPanel.classList.add('hidden');
  }

  private updateBadge() {
    if (this.unreadCount > 0) {
      this.msgBadge.textContent = this.unreadCount > 99 ? '99+' : String(this.unreadCount);
      this.msgBadge.classList.remove('hidden');
      this.msgBadge.classList.add('has-unread');
    } else {
      this.msgBadge.classList.add('hidden');
      this.msgBadge.classList.remove('has-unread');
    }
  }

  private clearUnread() {
    this.unreadCount = 0;
    this.updateBadge();
  }

  private renderExternalMessages() {
    if (this.externalMessages.length === 0) {
      this.externalMsgList.innerHTML = '<div class="empty-state">暂无外部消息</div>';
      return;
    }

    this.externalMsgList.innerHTML = this.externalMessages.map(msg => {
      const statusText = this.getStatusText(msg.status);
      const timeStr = new Date(msg.timestamp).toLocaleTimeString();
      const lastUserMsg = msg.messages.filter(m => m.role === 'user').pop();
      const previewContent = lastUserMsg?.content?.slice(0, 100) || '(无内容)';
      
      let responseContent = '';
      if (msg.status !== 'pending' && msg.responseContent) {
        responseContent = `<div class="msg-item-content collapsed">${this.escapeHtml(msg.responseContent.slice(0, 200))}</div>`;
      } else if (msg.status === 'error' && msg.error) {
        responseContent = `<div class="msg-item-content collapsed" style="color: #dc2626;">${this.escapeHtml(msg.error)}</div>`;
      }

      return `
        <div class="external-msg-item ${msg.status}">
          <div class="msg-item-header">
            <span class="msg-item-id">${msg.requestId.slice(0, 16)}...</span>
            <span class="msg-item-status ${msg.status}">${statusText}</span>
          </div>
          <div class="msg-item-info">
            <span>模型: ${msg.model}</span>
            <span>流式: ${msg.stream ? '是' : '否'}</span>
          </div>
          <div class="msg-item-content collapsed">${this.escapeHtml(previewContent)}</div>
          ${responseContent}
          <div class="msg-item-time">${timeStr}</div>
          ${msg.duration ? `<div class="msg-item-duration">耗时: ${msg.duration}ms</div>` : ''}
        </div>
      `;
    }).join('');
  }

  private getStatusText(status: string): string {
    switch (status) {
      case 'pending': return '处理中';
      case 'success': return '成功';
      case 'error': return '错误';
      case 'timeout': return '超时';
      default: return status;
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new ChatApp();
  app.init();
});
