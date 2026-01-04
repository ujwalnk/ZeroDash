export function renderLink(container, config) {
  const { image, label, url, target, statusCheckUrl } = config;
  
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.cursor = 'pointer';

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

  // Periodically check reachability if statusCheckUrl is provided
  let statusInterval = null;
  if (statusCheckUrl) {
    statusInterval = setInterval(async () => {
      try {
        const response = await fetch(statusCheckUrl, { method: 'HEAD' });
        if (response.ok) {
          container.style.opacity = '1';
        } else {
          container.style.opacity = '0.5';
        }
      } catch (error) {
        container.style.opacity = '0.5';
      }
    }, 5000); // Check every 5 seconds
  }

  container.addEventListener('click', () => {
    if (target === 'new') {
      window.open(url, '_blank');
    } else {
      window.location.href = url;
    }
  });

  // Cleanup interval on container removal
  const originalRemove = container.remove;
  container.remove = function() {
    if (statusInterval) {
      clearInterval(statusInterval);
    }
    originalRemove.call(this);
  };
}

