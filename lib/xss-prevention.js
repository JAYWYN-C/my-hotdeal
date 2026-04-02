/**
 * XSS Prevention Utilities
 * 프론트엔드 클라이언트에서 사용할 XSS 방지 기능
 */

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeHtml(text) {
  if (typeof text !== 'string') return '';

  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Sanitize HTML content (remove dangerous tags)
 * @param {string} html - HTML to sanitize
 * @returns {string} - Sanitized HTML
 */
function sanitizeHtml(html) {
  if (typeof html !== 'string') return '';

  const temp = document.createElement('div');
  temp.innerHTML = html;

  // Remove dangerous tags and attributes
  const dangerousTags = ['script', 'iframe', 'object', 'embed', 'form'];
  const dangerousAttrs = [
    'on.*', // onclick, onload, etc.
    'javascript:',
    'data:text/html',
  ];

  dangerousTags.forEach((tag) => {
    const elements = temp.querySelectorAll(tag);
    elements.forEach((el) => el.remove());
  });

  // Remove dangerous attributes
  temp.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.match(/^on/i) || attr.value.includes('javascript:')) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return temp.innerHTML;
}

/**
 * Create element safely from JSON data
 * @param {object} data - Data object
 * @param {function} createElementFn - Function that creates element from data
 * @returns {HTMLElement} - Safe element
 */
function createSafeElement(data, createElementFn) {
  // Sanitize all string values
  const sanitized = Object.entries(data).reduce((acc, [key, value]) => {
    if (typeof value === 'string') {
      acc[key] = escapeHtml(value);
    } else {
      acc[key] = value;
    }
    return acc;
  }, {});

  return createElementFn(sanitized);
}

/**
 * Validate external URL (prevent open redirects)
 * @param {string} url - URL to check
 * @param {array} allowedDomains - Allowed domains
 * @returns {boolean} - true if safe
 */
function isUrlSafe(url, allowedDomains = []) {
  if (!url) return false;

  try {
    const urlObj = new URL(url, window.location.origin);

    // Allow relative URLs and same-origin
    if (urlObj.origin === window.location.origin) {
      return true;
    }

    // Check against allowed domains
    return allowedDomains.some((domain) => urlObj.hostname === domain);
  } catch {
    return false;
  }
}

/**
 * Safe JSON parse with fallback
 * @param {string} jsonString - JSON string
 * @param {object} fallback - Fallback value
 * @returns {object} - Parsed or fallback
 */
function safeJsonParse(jsonString, fallback = {}) {
  try {
    return JSON.parse(jsonString);
  } catch {
    console.warn('Failed to parse JSON:', jsonString);
    return fallback;
  }
}

/**
 * Set Content Security Policy meta tag
 * @param {string} policy - CSP policy string
 */
function setContentSecurityPolicy(policy) {
  let meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    document.head.appendChild(meta);
  }
  meta.content = policy;
}

/**
 * Validate API request origin
 * @param {string} expectedOrigin - Expected origin
 * @returns {boolean} - true if valid
 */
function validateApiOrigin(expectedOrigin) {
  return window.location.origin === expectedOrigin;
}

/**
 * Get CSRF token from meta tag
 * @returns {string} - CSRF token
 */
function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute('content') : '';
}

/**
 * Make fetch request with CSRF token
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @returns {Promise<Response>} - Fetch response
 */
async function secureFetch(url, options = {}) {
  const csrfToken = getCsrfToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (csrfToken && options.method !== 'GET') {
    headers['X-CSRF-Token'] = csrfToken;
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin',
  });
}

/**
 * Prevent DOM-based XSS in innerHTML usage
 * @param {HTMLElement} element - Target element
 * @param {string} html - HTML content
 */
function setSafeInnerHTML(element, html) {
  element.innerHTML = sanitizeHtml(html);
}

// ============================================================================
// Export for use in app.js or other modules
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    escapeHtml,
    sanitizeHtml,
    createSafeElement,
    isUrlSafe,
    safeJsonParse,
    setContentSecurityPolicy,
    validateApiOrigin,
    getCsrfToken,
    secureFetch,
    setSafeInnerHTML,
  };
}

// Also make available globally for inline scripts
window.xssPrevention = {
  escapeHtml,
  sanitizeHtml,
  createSafeElement,
  isUrlSafe,
  safeJsonParse,
  setContentSecurityPolicy,
  validateApiOrigin,
  getCsrfToken,
  secureFetch,
  setSafeInnerHTML,
};
