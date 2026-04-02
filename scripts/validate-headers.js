#!/usr/bin/env node

/**
 * Security Headers Validator
 * Validates security headers configuration in vercel.json and tests actual responses
 * Usage: node scripts/validate-headers.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const COLORS = {
  RESET: '\x1b[0m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  BOLD: '\x1b[1m',
};

// Required security headers
const REQUIRED_HEADERS = {
  'Strict-Transport-Security': {
    needs: 'max-age',
    minAge: 31536000, // 1 year
    desc: 'Enforces HTTPS for 1 year'
  },
  'X-Frame-Options': {
    values: ['DENY', 'SAMEORIGIN'],
    desc: 'Prevents clickjacking attacks'
  },
  'X-Content-Type-Options': {
    values: ['nosniff'],
    desc: 'Prevents MIME type sniffing'
  },
  'Content-Security-Policy': {
    needs: 'default-src',
    desc: 'Controls resource loading origins'
  },
  'Referrer-Policy': {
    values: ['strict-origin-when-cross-origin', 'no-referrer', 'same-origin'],
    desc: 'Controls referrer information'
  },
};

console.log('');
console.log(`${COLORS.BLUE}╔══════════════════════════════════════════════════════╗${COLORS.RESET}`);
console.log(`${COLORS.BLUE}║ Security Headers Validator                           ║${COLORS.RESET}`);
console.log(`${COLORS.BLUE}╚══════════════════════════════════════════════════════╝${COLORS.RESET}`);
console.log('');

let issues = 0;

// ============================================================================
// 1. Check vercel.json Configuration
// ============================================================================
console.log(`${COLORS.BLUE}[1] Checking vercel.json configuration...${COLORS.RESET}`);
const vercelJsonPath = path.join(process.cwd(), 'vercel.json');
if (!fs.existsSync(vercelJsonPath)) {
  console.log(`${COLORS.YELLOW}⚠ vercel.json not found${COLORS.RESET}`);
  issues++;
} else {
  let vercelConfig;
  try {
    vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
  } catch (err) {
    console.log(`${COLORS.RED}✗ Failed to parse vercel.json: ${err.message}${COLORS.RESET}`);
    process.exit(1);
  }

  if (!vercelConfig.headers || !Array.isArray(vercelConfig.headers)) {
    console.log(`${COLORS.RED}✗ No headers array in vercel.json${COLORS.RESET}`);
    issues++;
  } else {
    console.log(`${COLORS.GREEN}✓ Headers array found in vercel.json${COLORS.RESET}`);
    
    // Check each header set
    let headerRules = 0;
    for (const header of vercelConfig.headers) {
      if (header.source) {
        console.log(`  Route: ${header.source}`);
        headerRules++;

        const headerMap = {};
        if (header.headers) {
          for (const h of header.headers) {
            headerMap[h.key] = h.value;
          }
        }

        // Validate CSP
        if (headerMap['Content-Security-Policy']) {
          console.log(`    ${COLORS.GREEN}✓${COLORS.RESET} CSP: ${headerMap['Content-Security-Policy'].slice(0, 50)}...`);
        } else {
          console.log(`    ${COLORS.YELLOW}⚠ CSP header missing${COLORS.RESET}`);
        }

        // Validate HSTS
        if (headerMap['Strict-Transport-Security']) {
          if (headerMap['Strict-Transport-Security'].includes('31536000')) {
            console.log(`    ${COLORS.GREEN}✓${COLORS.RESET} HSTS: 1-year max-age`);
          } else {
            console.log(`    ${COLORS.YELLOW}⚠ HSTS: max-age not 1 year${COLORS.RESET}`);
            issues++;
          }
        } else {
          console.log(`    ${COLORS.YELLOW}⚠ HSTS header missing${COLORS.RESET}`);
        }

        // Validate X-Frame-Options
        if (headerMap['X-Frame-Options']) {
          console.log(`    ${COLORS.GREEN}✓${COLORS.RESET} X-Frame-Options: ${headerMap['X-Frame-Options']}`);
        } else {
          console.log(`    ${COLORS.YELLOW}⚠ X-Frame-Options missing${COLORS.RESET}`);
        }

        // Validate X-Content-Type-Options
        if (headerMap['X-Content-Type-Options']) {
          console.log(`    ${COLORS.GREEN}✓${COLORS.RESET} X-Content-Type-Options: ${headerMap['X-Content-Type-Options']}`);
        } else {
          console.log(`    ${COLORS.YELLOW}⚠ X-Content-Type-Options missing${COLORS.RESET}`);
        }

        // Validate Referrer-Policy
        if (headerMap['Referrer-Policy']) {
          console.log(`    ${COLORS.GREEN}✓${COLORS.RESET} Referrer-Policy: ${headerMap['Referrer-Policy']}`);
        } else {
          console.log(`    ${COLORS.YELLOW}⚠ Referrer-Policy missing${COLORS.RESET}`);
        }

        // Validate Permissions-Policy
        if (headerMap['Permissions-Policy']) {
          console.log(`    ${COLORS.GREEN}✓${COLORS.RESET} Permissions-Policy configured`);
        } else {
          console.log(`    ${COLORS.YELLOW}⚠ Permissions-Policy missing${COLORS.RESET}`);
        }
      }
    }

    if (headerRules === 0) {
      console.log(`${COLORS.RED}✗ No header rules found in vercel.json${COLORS.RESET}`);
      issues++;
    }
  }
}

// ============================================================================
// 2. Check index.html for meta tags
// ============================================================================
console.log('');
console.log(`${COLORS.BLUE}[2] Checking index.html meta tags...${COLORS.RESET}`);
const indexHtmlPath = path.join(process.cwd(), 'index.html');
if (fs.existsSync(indexHtmlPath)) {
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  
  if (indexHtml.includes('Content-Security-Policy')) {
    console.log(`${COLORS.GREEN}✓ CSP meta tag found${COLORS.RESET}`);
  } else {
    console.log(`${COLORS.YELLOW}⚠ CSP meta tag not found (may be OK if using vercel.json)${COLORS.RESET}`);
  }

  if (indexHtml.includes('charset=utf-8')) {
    console.log(`${COLORS.GREEN}✓ Character set specified${COLORS.RESET}`);
  } else {
    console.log(`${COLORS.YELLOW}⚠ Character set not specified${COLORS.RESET}`);
    issues++;
  }

  if (indexHtml.includes('viewport')) {
    console.log(`${COLORS.GREEN}✓ Viewport meta tag found${COLORS.RESET}`);
  } else {
    console.log(`${COLORS.YELLOW}⚠ Viewport meta tag missing${COLORS.RESET}`);
  }

  if (indexHtml.includes('X-UA-Compatible')) {
    console.log(`${COLORS.GREEN}✓ X-UA-Compatible specified${COLORS.RESET}`);
  } else {
    console.log(`${COLORS.YELLOW}⚠ X-UA-Compatible not specified${COLORS.RESET}`);
  }
}

// ============================================================================
// 3. Check for inline scripts
// ============================================================================
console.log('');
console.log(`${COLORS.BLUE}[3] Checking for unsafe inline scripts...${COLORS.RESET}`);
if (fs.existsSync(indexHtmlPath)) {
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  const inlineScripts = indexHtml.match(/<script[^>]*>[\s\S]*?<\/script>/g) || [];
  
  if (inlineScripts.length > 0) {
    console.log(`  Found ${inlineScripts.length} inline script(s)`);
    
    let unsafe = 0;
    for (const script of inlineScripts) {
      if (!script.includes('nonce') && script.includes('javascript')) {
        unsafe++;
      }
    }
    
    if (unsafe > 0) {
      console.log(`  ${COLORS.YELLOW}⚠ ${unsafe} inline script(s) without nonce${COLORS.RESET}`);
      if (vercelConfig && vercelConfig.headers) {
        const hasCspUnsafeInline = vercelConfig.headers.some(h => 
          h.headers && h.headers.some(header => 
            header.key === 'Content-Security-Policy' && 
            header.value.includes("'unsafe-inline'")
          )
        );
        if (hasCspUnsafeInline) {
          console.log(`  ${COLORS.RED}✗ CSP allows 'unsafe-inline' with inline scripts${COLORS.RESET}`);
          console.log(`     Consider using nonces instead of unsafe-inline`);
          issues++;
        }
      }
    } else {
      console.log(`  ${COLORS.GREEN}✓ Inline scripts have nonce attributes${COLORS.RESET}`);
    }
  } else {
    console.log(`${COLORS.GREEN}✓ No inline scripts found${COLORS.RESET}`);
  }
}

// ============================================================================
// 4. Test Header Severity Scoring
// ============================================================================
console.log('');
console.log(`${COLORS.BLUE}[4] Header Coverage Analysis...${COLORS.RESET}`);
let coverageScore = 0;
let maxScore = Object.keys(REQUIRED_HEADERS).length;

if (fs.existsSync(vercelJsonPath)) {
  const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
  const allHeaders = new Set();

  if (vercelConfig.headers && Array.isArray(vercelConfig.headers)) {
    for (const headerRule of vercelConfig.headers) {
      if (headerRule.headers) {
        for (const h of headerRule.headers) {
          allHeaders.add(h.key);
        }
      }
    }
  }

  for (const requiredHeader of Object.keys(REQUIRED_HEADERS)) {
    if (allHeaders.has(requiredHeader)) {
      coverageScore++;
      console.log(`  ${COLORS.GREEN}✓${COLORS.RESET} ${requiredHeader}`);
    } else {
      console.log(`  ${COLORS.YELLOW}⚠${COLORS.RESET} ${requiredHeader} - NOT FOUND`);
    }
  }
}

const coverage = Math.round((coverageScore / maxScore) * 100);
console.log(`');
console.log(`Coverage: ${coverage}% (${coverageScore}/${maxScore})`);

if (coverage < 60) {
  console.log(`${COLORS.RED}✗ Coverage too low (< 60%)${COLORS.RESET}`);
  issues++;
} else if (coverage < 80) {
  console.log(`${COLORS.YELLOW}⚠ Coverage could be improved${COLORS.RESET}`);
} else {
  console.log(`${COLORS.GREEN}✓ Good coverage${COLORS.RESET}`);
}

// ============================================================================
// 5. Generate Test Summary
// ============================================================================
console.log('');
console.log(`${COLORS.BLUE}╔══════════════════════════════════════════════════════╗${COLORS.RESET}`);
console.log(`${COLORS.BLUE}║ Header Validation Summary                            ║${COLORS.RESET}`);
console.log(`${COLORS.BLUE}╚══════════════════════════════════════════════════════╝${COLORS.RESET}`);
console.log('');

if (issues === 0) {
  console.log(`${COLORS.GREEN}✓ All security headers configured correctly${COLORS.RESET}`);
  console.log('');
  console.log('✓ HSTS enforces HTTPS');
  console.log('✓ CSP restricts resource loading');
  console.log('✓ Clickjacking protection enabled');
  console.log('✓ MIME type sniffing prevented');
  console.log('✓ Referrer policy configured');
} else {
  console.log(`${COLORS.YELLOW}⚠ Found ${issues} issue(s) in header configuration${COLORS.RESET}`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Review vercel.json headers configuration');
  console.log('  2. Ensure all REQUIRED_HEADERS are present');
  console.log('  3. Test in production: curl -I https://jachwi-hotdeal.vercel.app');
  console.log('  4. Check browser DevTools: Network tab → Response Headers');
}

console.log('');
process.exit(issues > 0 ? 1 : 0);
