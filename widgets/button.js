export function renderButton(container, config) {
  const { image, label, url, method, payload } = config;
  
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.cursor = 'pointer';
  container.style.transition = 'transform 0.2s';

  if (image) {
    const img = document.createElement('img');
    img.src = image;
    img.style.maxWidth = '80%';
    img.style.maxHeight = '60%';
    img.style.objectFit = 'contain';
    container.appendChild(img);
  }

  const labelDiv = document.createElement('div');
  labelDiv.textContent = label;
  labelDiv.style.marginTop = '10px';
  labelDiv.style.fontSize = '1.2em';
  labelDiv.style.textAlign = 'center';
  container.appendChild(labelDiv);

  container.addEventListener('click', async () => {
    try {
      const options = {
        method: method,
        headers: {}
      };

      if (method === 'POST' && payload) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(payload);
      }

      const response = await fetch(url, options);
      
      if (response.ok) {
        // Animate on success
        container.style.transform = 'scale(0.95)';
        setTimeout(() => {
          container.style.transform = 'scale(1)';
        }, 200);
      }
    } catch (error) {
      console.error('Button click error:', error);
    }
  });
}

