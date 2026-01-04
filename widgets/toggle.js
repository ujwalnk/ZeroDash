export function renderToggle(container, config) {
  const { label, displayLabel, method, payload, targetUrl, statusCheckUrl } = config;
  
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.cursor = 'pointer';

  const img = document.createElement('img');
  img.style.maxWidth = '80%';
  img.style.maxHeight = displayLabel ? '60%' : '80%';
  img.style.objectFit = 'contain';
  container.appendChild(img);

  if (displayLabel) {
    const labelDiv = document.createElement('div');
    labelDiv.textContent = label;
    labelDiv.style.marginTop = '10px';
    labelDiv.style.fontSize = '1.2em';
    labelDiv.style.textAlign = 'center';
    container.appendChild(labelDiv);
  }

  let currentState = null;

  async function fetchStatus() {
    try {
      const response = await fetch(statusCheckUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        // Try to parse as JSON, fallback to text
        try {
          data = JSON.parse(text);
        } catch {
          data = text.trim().toLowerCase() === 'true' || text.trim() === '1';
          console.log("Data from status check for", statusCheckUrl, "is", data);

        }
      }
      
      // Extract boolean value
      let state = false;
      if (typeof data === 'boolean') {
        state = data;
      } else if (data && typeof data === 'object') {
        state = data.status === true || data.value === true || data.state === true;
      } else {
        state = Boolean(data);
      }
      
      currentState = state;
      img.src = state ? targetUrl.trueImage : targetUrl.falseImage;
      
      // Clear any error message
      const errorDiv = container.querySelector('.toggle-error');
      if (errorDiv) {
        errorDiv.remove();
      }
    } catch (error) {
      console.error('Toggle status check error:', error);
      // Show error but preserve structure
      let errorDiv = container.querySelector('.toggle-error');
      if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'toggle-error';
        errorDiv.style.padding = '5px';
        errorDiv.style.color = 'red';
        errorDiv.style.fontSize = '0.8em';
        errorDiv.style.textAlign = 'center';
        container.appendChild(errorDiv);
      }
      errorDiv.textContent = `Error: ${error.message}`;
    }
  }

  async function toggleState() {
    if (currentState === null) return;

    try {
      const toggleUrl = currentState ? targetUrl.falseUrl : targetUrl.trueUrl;
      
      const options = {
        method: method,
        headers: {}
      };

      if (method === 'POST' && payload) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(payload);
      }

      await fetch(toggleUrl, options);
      
      // Re-fetch status after toggle
      await fetchStatus();
    } catch (error) {
      console.error('Toggle error:', error);
    }
  }

  // On load: fetch status
  fetchStatus();

  // On click: toggle
  container.addEventListener('click', toggleState);
}

