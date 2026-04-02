/**
 * API Security Middleware
 * 모든 API 엔드포인트에 적용할 보안 기능
 */

const crypto = require('crypto');

// ============================================================================
// CORS Configuration
// ============================================================================

/**
 * CORS 정책 설정
 * @param {http.ServerResponse} res - Response object
 * @param {string} method - HTTP method
 */
function setCorsHeaders(res, origin = '') {
  // 허용할 origin 필터링 (localhost와 배포 도메인)
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    'https://jachwi-hotdeal.vercel.app',
    'https://hotdeal.kr',
    'https://www.hotdeal.kr',
  ].filter(Boolean);

  const originIsAllowed = allowedOrigins.includes(origin);

  if (originIsAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// ============================================================================
// Security Headers
// ============================================================================

/**
 * 보안 헤더 설정
 * @param {http.ServerResponse} res - Response object
 */
function setSecurityHeaders(res) {
  // Cache control
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Content security
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Clickjacking protection
  res.setHeader('X-Frame-Options', 'DENY');

  // XSS protection (legacy)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Feature policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
}

// ============================================================================
// Rate Limiting
// ============================================================================

const rateLimitStores = new Map(); // Simple in-memory rate limit store

/**
 * Rate limiting middleware
 * @param {http.ClientRequest} req - Request object
 * @param {number} maxRequests - Maximum requests per window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {boolean} - true if within limit, false if exceeded
 */
function checkRateLimit(req, maxRequests = 100, windowMs = 60000) {
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  const now = Date.now();
  const key = `${ip}:${req.url}`;

  if (!rateLimitStores.has(key)) {
    rateLimitStores.set(key, { count: 0, resetTime: now + windowMs });
  }

  const store = rateLimitStores.get(key);

  // Reset window if expired
  if (now > store.resetTime) {
    store.count = 0;
    store.resetTime = now + windowMs;
  }

  store.count++;

  // Cleanup old entries
  if (Math.random() < 0.01) {
    for (const [k, v] of rateLimitStores.entries()) {
      if (now > v.resetTime) {
        rateLimitStores.delete(k);
      }
    }
  }

  return store.count <= maxRequests;
}

/**
 * Get rate limit headers
 * @param {number} maxRequests - Maximum requests
 * @param {number} windowMs - Time window
 * @returns {object} - Headers object
 */
function getRateLimitHeaders(maxRequests = 100, windowMs = 60000) {
  const remaining = Math.max(0, maxRequests - 1);
  return {
    'X-RateLimit-Limit': maxRequests.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': Math.ceil((Date.now() + windowMs) / 1000).toString(),
    'Retry-After': Math.ceil(windowMs / 1000).toString(),
  };
}

// ============================================================================
// Input Validation
// ============================================================================

/**
 * Validate input string (prevent XSS, injection)
 * @param {string} input - Input to validate
 * @param {object} options - Validation options
 * @returns {boolean} - true if valid
 */
function isValidInput(input, options = {}) {
  if (typeof input !== 'string') return false;

  const {
    maxLength = 1000,
    minLength = 0,
    pattern = null,
    allowHtml = false,
  } = options;

  if (input.length < minLength || input.length > maxLength) {
    return false;
  }

  // Check for suspicious patterns if not allowing HTML
  if (!allowHtml) {
    // Block script tags and common XSS patterns
    if (/<script|javascript:|on\w+\s*=|<iframe|<object|<embed/i.test(input)) {
      return false;
    }
  }

  // Apply custom pattern if provided
  if (pattern && !pattern.test(input)) {
    return false;
  }

  return true;
}

/**
 * Sanitize user input
 * @param {string} input - Input to sanitize
 * @returns {string} - Sanitized input
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - true if valid
 */
function isValidEmail(email) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && emailPattern.test(email) && email.length <= 254;
}

/**
 * Validate URL
 * @param {string} url - URL to validate
 * @returns {boolean} - true if valid
 */
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// CSRF Protection
// ============================================================================

/**
 * Generate CSRF token
 * @returns {string} - CSRF token
 */
function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Verify CSRF token
 * @param {string} token - Token to verify
 * @param {string} storedToken - Stored token
 * @returns {boolean} - true if valid
 */
function verifyCsrfToken(token, storedToken) {
  if (!token || !storedToken) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(storedToken));
}

// ============================================================================
// Request/Response Helpers
// ============================================================================

/**
 * Parse JSON body safely
 * @param {http.ClientRequest} req - Request object
 * @returns {Promise<object>} - Parsed body
 */
async function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.method === 'GET') {
      resolve({});
      return;
    }

    if (req.body && typeof req.body === 'object') {
      resolve(req.body);
      return;
    }

    let data = '';
    const timeout = setTimeout(() => {
      req.removeAllListeners();
      reject(new Error('Request timeout'));
    }, 5000); // 5 second timeout

    req.on('data', (chunk) => {
      data += chunk.toString('utf-8');
      if (data.length > 1_000_000) {
        // 1MB limit
        req.removeAllListeners();
        clearTimeout(timeout);
        reject(new Error('Payload too large'));
      }
    });

    req.on('end', () => {
      clearTimeout(timeout);
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });

    req.on('error', reject);
  });
}

/**
 * Send JSON response
 * @param {http.ServerResponse} res - Response object
 * @param {number} statusCode - HTTP status code
 * @param {object} data - Response data
 */
function sendJsonResponse(res, statusCode, data) {
  res.statusCode = statusCode;
  res.end(JSON.stringify(data));
}

/**
 * Send error response
 * @param {http.ServerResponse} res - Response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 */
function sendErrorResponse(res, statusCode, message) {
  res.statusCode = statusCode;
  res.end(JSON.stringify({ error: message }));
}

// ============================================================================
// Export
// ============================================================================

module.exports = {
  setCorsHeaders,
  setSecurityHeaders,
  checkRateLimit,
  getRateLimitHeaders,
  isValidInput,
  sanitizeInput,
  isValidEmail,
  isValidUrl,
  generateCsrfToken,
  verifyCsrfToken,
  parseJsonBody,
  sendJsonResponse,
  sendErrorResponse,
};
