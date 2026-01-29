// ==================== THEME MANAGEMENT ==================== //

/**
 * Initialize theme from localStorage and apply to document
 */
function initializeTheme() {
  const savedMode = localStorage.getItem('themeMode');
  
  if (savedMode === 'dark') {
    applyTheme('dark');
  } else {
    // Default to light mode
    applyTheme('light');
  }
  
  // Update toggle switches if they exist
  updateToggleSwitches();
}

/**
 * Apply theme to the document
 * @param {string} mode - 'light' or 'dark'
 */
function applyTheme(mode) {
  const body = document.body;
  
  if (mode === 'light') {
    body.classList.remove('dark-mode');
    body.classList.add('light-mode');
    localStorage.setItem('themeMode', 'light');
  } else {
    body.classList.remove('light-mode');
    body.classList.add('dark-mode');
    localStorage.setItem('themeMode', 'dark');
  }
  
  updateToggleSwitches();
}

/**
 * Toggle between dark and light modes
 */
function toggleTheme() {
  const isDarkMode = document.body.classList.contains('dark-mode');
  applyTheme(isDarkMode ? 'light' : 'dark');
}

/**
 * Update all theme toggle switches to match current theme
 */
function updateToggleSwitches() {
  const isLightMode = document.body.classList.contains('light-mode');
  
  // Update all toggle switches
  const toggleSwitches = document.querySelectorAll('[data-theme-toggle], #darkModeSwitch, .theme-toggle');
  toggleSwitches.forEach(toggle => {
    if (toggle.type === 'checkbox') {
      toggle.checked = isLightMode;
    }
  });
}

/**
 * Setup theme toggle listeners
 */
function setupThemeToggleListeners() {
  // Find all potential toggle elements
  const darkModeSwitch = document.getElementById('darkModeSwitch');
  const themeToggleButtons = document.querySelectorAll('[data-theme-toggle]');
  const themeToggleClass = document.querySelectorAll('.theme-toggle');
  
  // Handle checkbox toggles
  const checkboxToggles = [darkModeSwitch, ...themeToggleButtons, ...themeToggleClass].filter(el => el !== null);
  
  checkboxToggles.forEach(toggle => {
    if (toggle.type === 'checkbox') {
      toggle.addEventListener('change', () => {
        const isLightMode = toggle.checked;
        applyTheme(isLightMode ? 'light' : 'dark');
      });
    } else {
      // Button click
      toggle.addEventListener('click', toggleTheme);
    }
  });
}

// ==================== AUTO-INIT ON DOM READY ==================== //

// Initialize theme when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    setupThemeToggleListeners();
  });
} else {
  // DOM is already loaded
  initializeTheme();
  setupThemeToggleListeners();
}

// Also set up listeners after a short delay to catch dynamically added elements
setTimeout(() => {
  setupThemeToggleListeners();
}, 100);
