export function selectLayout(layouts) {
  if (!Array.isArray(layouts) || layouts.length === 0) {
    throw new Error('Layouts must be a non-empty array');
  }

  // Validate all layouts have unique names
  const names = layouts.map(l => l.name);
  const uniqueNames = new Set(names);
  if (names.length !== uniqueNames.size) {
    throw new Error('Layout names must be unique');
  }

  // 1. Check URL override (HIGHEST PRIORITY)
  const urlOverride = getUrlOverride();
  if (urlOverride) {
    const layout = layouts.find(l => l.name === urlOverride);
    if (!layout) {
      throw new Error(`Layout "${urlOverride}" not found (URL override)`);
    }
    return layout;
  }

  // 2. Media query matching
  for (const layout of layouts) {
    if (layout.mediaQuery) {
      try {
        if (window.matchMedia(layout.mediaQuery).matches) {
          return layout;
        }
      } catch (error) {
        console.warn(`Invalid media query for layout "${layout.name}": ${layout.mediaQuery}`, error);
        // Continue to next layout
      }
    }
  }

  // 3. Fallback - first layout without mediaQuery
  const fallbackLayout = layouts.find(l => !l.mediaQuery);
  if (fallbackLayout) {
    return fallbackLayout;
  }

  // 4. Failure
  throw new Error('No layout could be resolved');
}

function getUrlOverride() {
  const pathname = window.location.pathname;
  
  // Check path: /<layoutName> (highest priority - direct path)
  // Only match if pathname is exactly "/<name>" and not "/" or empty
  if (pathname !== '/' && pathname.length > 1) {
    const directMatch = pathname.match(/^\/([^\/]+)$/);
    if (directMatch) {
      const layoutName = decodeURIComponent(directMatch[1]);
      // Only return if it's not a common path like "index.html"
      if (layoutName && !layoutName.includes('.')) {
        return layoutName;
      }
    }
  }

  // Check path: /layout/<layoutName>
  const pathMatch = pathname.match(/\/layout\/([^\/]+)/);
  if (pathMatch) {
    return decodeURIComponent(pathMatch[1]);
  }

  // Check query parameter: ?layout=<layoutName>
  const params = new URLSearchParams(window.location.search);
  const layoutParam = params.get('layout');
  if (layoutParam) {
    return decodeURIComponent(layoutParam);
  }

  return null;
}

