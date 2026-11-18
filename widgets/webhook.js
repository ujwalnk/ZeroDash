import { resolveUrl } from '../core/urlResolver.js';

export function renderWebhook(container, config) {
  const { method, payload } = config;
  const targetUrl = resolveUrl(config.targetUrl);
  const statusCheckUrl = resolveUrl(config.statusCheckUrl);
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'webhook-content';
  contentDiv.style.width = '100%';
  contentDiv.style.height = '100%';
  contentDiv.style.overflow = 'auto';
  container.appendChild(contentDiv);

  async function fetchAndRender(url, fetchMethod = 'GET', fetchPayload = null) {
    try {
      const options = {
        method: fetchMethod,
        headers: {}
      };

      if (fetchMethod === 'POST' && fetchPayload) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(fetchPayload);
      }

      const response = await fetch(url, options);
      const html = await response.text();
      contentDiv.innerHTML = html;
    } catch (error) {
      contentDiv.innerHTML = `<div style="padding: 10px; color: red;">Error: ${error.message}</div>`;
    }
  }

  // On load: fetch statusCheckUrl or targetUrl
  const initialUrl = statusCheckUrl || targetUrl;
  fetchAndRender(initialUrl);

  // On click: trigger webhook
  container.style.cursor = 'pointer';
  container.addEventListener('click', () => {
    fetchAndRender(targetUrl, method, payload);
  });
}

