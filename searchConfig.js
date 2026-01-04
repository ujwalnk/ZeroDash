/**
 * SEARCH CONFIGURATION
 * 
 * Defines customizable prefix shortcuts for the global search.
 * 
 * DEFAULT PREFIXES (if this config is empty or missing):
 * - "@" → applications
 * - "/" → buttons
 * - "." → toggles
 * - no prefix → all types
 * 
 * CUSTOM PREFIXES:
 * Uncomment and modify to override defaults
 */

export const searchConfig = {
  // Enable/disable the entire search feature
  enabled: true,
  
  // Configure prefix shortcuts
  // Key: prefix character
  // Value: array of tile types to filter by
  // Valid types: 'application', 'link', 'button', 'toggle'
  prefixes: {
    '@': ['application'],        // @ = applications only
    '#': ['application', 'link'],  // # = applications and links
    '/': ['button'],             // / = buttons only
    '.': ['toggle'],             // . = toggles only
    // No prefix = all types (configured in SearchEngine)
  }
};
