import type { ApiConfig } from '../types';
import { DEFAULT_CONFIG } from '../types';
import { saveConfig, loadConfig } from '../services/storage';

class OptionsPage {
  private form!: HTMLFormElement;
  private statusMessage!: HTMLElement;
  private temperatureSlider!: HTMLInputElement;
  private temperatureValue!: HTMLElement;

  async init() {
    this.form = document.getElementById('settings-form') as HTMLFormElement;
    this.statusMessage = document.getElementById('status-message')!;
    this.temperatureSlider = document.getElementById('temperature') as HTMLInputElement;
    this.temperatureValue = document.getElementById('temperature-value')!;

    await this.loadSettings();
    this.bindEvents();
  }

  private async loadSettings() {
    const config = await loadConfig<ApiConfig>(DEFAULT_CONFIG);

    (document.getElementById('endpoint') as HTMLInputElement).value = config.endpoint;
    (document.getElementById('apiKey') as HTMLInputElement).value = config.apiKey;
    (document.getElementById('model') as HTMLInputElement).value = config.model;
    (document.getElementById('temperature') as HTMLInputElement).value = String(config.temperature);
    (document.getElementById('maxTokens') as HTMLInputElement).value = String(config.maxTokens);
    (document.getElementById('stream') as HTMLInputElement).checked = config.stream;

    this.temperatureValue.textContent = String(config.temperature);
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
  }

  private getFormData(): ApiConfig {
    return {
      endpoint: (document.getElementById('endpoint') as HTMLInputElement).value.trim(),
      apiKey: (document.getElementById('apiKey') as HTMLInputElement).value.trim(),
      model: (document.getElementById('model') as HTMLInputElement).value.trim(),
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
        this.showStatus('✅ 连接成功！API端点可用', 'success');
      } else {
        this.showStatus('❌ 连接失败：' + response.message, 'error');
      }
    } catch (error) {
      this.showStatus('❌ 连接失败：' + (error instanceof Error ? error.message : '未知错误'), 'error');
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
