export function renderApplication(container, config) {
  const { image, label, url, target, availabilityUrl } = config;
  
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

  // Determine availability check URL (fallback to url if availabilityUrl not provided)
  const checkUrl = availabilityUrl ?? url;

  // Availability check function
  let statusInterval = null;
  let isChecking = false;
  
  const checkAvailability = async () => {
    // Prevent overlapping checks
    if (isChecking) {
      return;
    }
    
    isChecking = true;
    
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(checkUrl, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        // Application is reachable
        container.classList.remove('unreachable');
      } else {
        // Application is unreachable
        container.classList.add('unreachable');
      }
    } catch (error) {
      // Error or timeout - application is unreachable
      container.classList.add('unreachable');
    } finally {
      isChecking = false;
    }
  };

  // Initial check after render
  // Use requestAnimationFrame to ensure DOM is ready
  requestAnimationFrame(() => {
    checkAvailability();
  });

  // Set up periodic checks every 60 seconds
  statusInterval = setInterval(checkAvailability, 60000);

  // Click handler - ALWAYS navigate to config.url (never availabilityUrl)
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

