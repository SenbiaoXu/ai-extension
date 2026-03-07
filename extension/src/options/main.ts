import type { ApiConfig, ModelInfo } from '../types';
import { DEFAULT_CONFIG } from '../types';
import { saveConfig, loadConfig } from '../services/storage';

class OptionsPage {
  private form!: HTMLFormElement;
  private statusMessage!: HTMLElement;
  private temperatureSlider!: HTMLInputElement;
  private temperatureValue!: HTMLElement;
  private modelSelect!: HTMLSelectElement;
  private refreshModelsBtn!: HTMLButtonElement;
  private availableModels: ModelInfo[] = [];

  async init() {
    this.form = document.getElementById('settings-form') as HTMLFormElement;
    this.statusMessage = document.getElementById('status-message')!;
    this.temperatureSlider = document.getElementById('temperature') as HTMLInputElement;
    this.temperatureValue = document.getElementById('temperature-value')!;
    this.modelSelect = document.getElementById('model') as HTMLSelectElement;
    this.refreshModelsBtn = document.getElementById('refresh-models-btn') as HTMLButtonElement;

    await this.loadSettings();
    this.bindEvents();
  }

  private async loadSettings() {
    const config = await loadConfig<ApiConfig>(DEFAULT_CONFIG);

    (document.getElementById('endpoint') as HTMLInputElement).value = config.endpoint;
    (document.getElementById('apiKey') as HTMLInputElement).value = config.apiKey;
    (document.getElementById('temperature') as HTMLInputElement).value = String(config.temperature);
    (document.getElementById('maxTokens') as HTMLInputElement).value = String(config.maxTokens);
    (document.getElementById('stream') as HTMLInputElement).checked = config.stream;

    this.temperatureValue.textContent = String(config.temperature);

    if (config.endpoint) {
      await this.fetchModels(config.endpoint, config.apiKey, config.model);
    }
  }

  private bindEvents() {
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveSettings();
    });

    document.getElementById('test-btn')?.addEventListener('click', () => {
      this.testConnection();
    });

    document.getElementById('reset-btn')?.addEventListener('click', () => {
      this.resetSettings();
    });

    this.temperatureSlider.addEventListener('input', () => {
      this.temperatureValue.textContent = this.temperatureSlider.value;
    });

    this.refreshModelsBtn.addEventListener('click', () => {
      this.handleRefreshModels();
    });
  }

  private async handleRefreshModels() {
    const endpoint = (document.getElementById('endpoint') as HTMLInputElement).value.trim();
    const apiKey = (document.getElementById('apiKey') as HTMLInputElement).value.trim();
    
    if (!endpoint) {
      this.showStatus('请先输入API端点', 'error');
      return;
    }

    await this.fetchModels(endpoint, apiKey);
  }

  private async fetchModels(endpoint: string, apiKey: string, selectedModel?: string) {
    this.refreshModelsBtn.disabled = true;
    this.refreshModelsBtn.classList.add('loading');
    this.modelSelect.disabled = true;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'fetch-models',
        config: { endpoint, apiKey },
      });

      if (response.success && response.models) {
        this.availableModels = response.models;
        this.populateModelSelect(selectedModel);
        this.showStatus(`成功获取 ${response.models.length} 个模型`, 'success');
      } else {
        this.showStatus('获取模型列表失败：' + (response.message || '未知错误'), 'error');
        this.modelSelect.innerHTML = '<option value="">获取模型失败</option>';
      }
    } catch (error) {
      this.showStatus('获取模型列表失败：' + (error instanceof Error ? error.message : '未知错误'), 'error');
      this.modelSelect.innerHTML = '<option value="">获取模型失败</option>';
    } finally {
      this.refreshModelsBtn.disabled = false;
      this.refreshModelsBtn.classList.remove('loading');
      this.modelSelect.disabled = false;
    }
  }

  private populateModelSelect(selectedModel?: string) {
    this.modelSelect.innerHTML = '';

    if (this.availableModels.length === 0) {
      this.modelSelect.innerHTML = '<option value="">无可用模型</option>';
      this.modelSelect.disabled = true;
      return;
    }

    for (const model of this.availableModels) {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.id;
      this.modelSelect.appendChild(option);
    }

    this.modelSelect.disabled = false;

    if (selectedModel && this.availableModels.some(m => m.id === selectedModel)) {
      this.modelSelect.value = selectedModel;
    } else {
      this.modelSelect.value = this.availableModels[0].id;
    }
  }

  private getFormData(): ApiConfig {
    return {
      endpoint: (document.getElementById('endpoint') as HTMLInputElement).value.trim(),
      apiKey: (document.getElementById('apiKey') as HTMLInputElement).value.trim(),
      model: this.modelSelect.value,
      temperature: parseFloat(this.temperatureSlider.value),
      maxTokens: parseInt((document.getElementById('maxTokens') as HTMLInputElement).value, 10),
      stream: (document.getElementById('stream') as HTMLInputElement).checked,
    };
  }

  private async saveSettings() {
    try {
      const config = this.getFormData();
      await saveConfig(config);
      this.showStatus('设置已保存', 'success');
    } catch {
      this.showStatus('保存失败，请重试', 'error');
    }
  }

  private async testConnection() {
    const config = this.getFormData();
    this.showStatus('正在测试连接...', 'success');

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'test-connection',
        config,
      });

      if (response.success) {
        this.showStatus('连接成功！API端点可用', 'success');
      } else {
        this.showStatus('连接失败：' + response.message, 'error');
      }
    } catch (error) {
      this.showStatus('连接失败：' + (error instanceof Error ? error.message : '未知错误'), 'error');
    }
  }

  private async resetSettings() {
    await saveConfig(DEFAULT_CONFIG);
    await this.loadSettings();
    this.showStatus('设置已重置为默认值', 'success');
  }

  private showStatus(message: string, type: 'success' | 'error') {
    this.statusMessage.textContent = message;
    this.statusMessage.className = `status-message show ${type}`;

    setTimeout(() => {
      this.statusMessage.classList.remove('show');
    }, 3000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const page = new OptionsPage();
  page.init();
});
