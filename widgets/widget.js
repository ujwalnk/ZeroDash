// Widget module - placeholder for any shared widget utilities
// Currently all widget logic is in individual widget files

export function createWidgetContainer() {
  const container = document.createElement('div');
  container.className = 'widget-container';
  return container;
}

