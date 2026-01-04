/**
 * Text fitting utility to ensure labels fit within their containers
 * by dynamically adjusting font size before resorting to truncation.
 */

/**
 * Fits text to width by reducing font size until it fits or minimum is reached.
 * Only applies ellipsis if minimum font size is reached and text still doesn't fit.
 * 
 * @param {HTMLElement} element - The element containing the text to fit
 * @param {Object} options - Configuration options
 * @param {number} options.minFontSize - Minimum font size in pixels (default: 8)
 * @param {number} options.maxFontSize - Maximum font size in pixels (default: 18)
 */
export function fitTextToWidth(element, {
  minFontSize = 8,
  maxFontSize = 18
} = {}) {
  if (!element || !element.textContent || !element.textContent.trim()) {
    return; // Skip empty elements
  }

  // Ensure element is visible and has proper constraints for measurement
  const originalDisplay = element.style.display;
  const originalWidth = element.style.width;
  
  // Ensure element is inline-block for proper measurement
  if (element.style.display === 'none') {
    element.style.display = 'inline-block';
  } else if (!element.style.display || element.style.display === '') {
    element.style.display = 'inline-block';
  }
  
  // Ensure width constraint exists for measurement
  if (!element.style.width || element.style.width === '') {
    element.style.width = '100%';
  }

  // Reset to max font size and disable ellipsis initially
  let size = maxFontSize;
  element.style.fontSize = size + 'px';
  element.style.textOverflow = 'clip';
  element.style.overflow = 'hidden';
  
  // Force a reflow to ensure measurements are accurate
  void element.offsetHeight;

  // Measure and reduce font size until text fits
  while (
    size > minFontSize &&
    element.scrollWidth > element.clientWidth
  ) {
    size--;
    element.style.fontSize = size + 'px';
    // Force reflow for accurate measurement
    void element.offsetHeight;
  }

  // If text still doesn't fit at minimum size, enable ellipsis
  if (element.scrollWidth > element.clientWidth) {
    element.style.textOverflow = 'ellipsis';
  }

  // Restore original width if it was changed
  if (originalWidth) {
    element.style.width = originalWidth;
  } else if (element.style.width === '100%') {
    element.style.width = '';
  }
}

/**
 * Applies text fitting to all label elements within a container.
 * Finds all span and div elements that are direct children of tiles
 * (excluding webhook-content and toggle-error classes).
 * 
 * @param {HTMLElement} container - Container element to search for labels
 * @param {Object} options - Options to pass to fitTextToWidth
 */
export function fitAllLabels(container, options = {}) {
  if (!container) {
    return;
  }

  // Find all tiles
  const tiles = container.querySelectorAll('.tile');
  
  tiles.forEach(tile => {
    // Find label elements (span or div) that are direct children
    // Exclude webhook-content and toggle-error
    const labels = Array.from(tile.children).filter(child => {
      return (
        (child.tagName === 'SPAN' || child.tagName === 'DIV') &&
        !child.classList.contains('webhook-content') &&
        !child.classList.contains('toggle-error')
      );
    });

    labels.forEach(label => {
      fitTextToWidth(label, options);
    });
  });
}

