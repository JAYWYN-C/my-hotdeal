#!/usr/bin/env node

/**
 * Security Dependency Checker
 * Analyzes package.json dependencies for known vulnerabilities and best practices
 * Usage: node scripts/check-dependencies.js
 */

const fs = require('fs');
const path = require('path');

const COLORS = {
  RESET: '\x1b[0m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  BOLD: '\x1b[1m',
};

// Known vulnerable packages and their safe versions
const VULNERABLE_PACKAGES = {
  'lodash': { min: '4.17.21', reason: 'Prototype pollution vulnerability' },
  'express': { min: '4.18.0', reason: 'Query parser DoS vulnerability' },
  'ejs': { min: '3.1.5', reason: 'Template injection vulnerability' },
  'serialize-javascript': { min: '6.0.0', reason: 'Code execution vulnerability' },
  'pug': { min: '3.0.1', reason: 'Code injection vulnerability' },
};

// Best practice recommendations
const BEST_PRACTICES = {
  devDependencies: {
    should: ['eslint', 'prettier', 'jest', 'mocha', 'chai'],
    notMissing: ['eslint-plugin-security'],
  },
  dependencies: {
    heavy: ['lodash', 'moment', 'underscore'],
    mustBeLight: ['uuid', 'validator', 'is-url-valid'],
  },
};

console.log('');
console.log(`${COLORS.BLUE}╔══════════════════════════════════════════════════════╗${COLORS.RESET}`);
console.log(`${COLORS.BLUE}║ Security Dependency Checker                          ║${COLORS.RESET}`);
console.log(`${COLORS.BLUE}╚══════════════════════════════════════════════════════╝${COLORS.RESET}`);
console.log('');

// Read package.json
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error(`${COLORS.RED}✗ package.json not found${COLORS.RESET}`);
  process.exit(1);
}

let packageJson;
try {
  packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
} catch (err) {
  console.error(`${COLORS.RED}✗ Failed to parse package.json: ${err.message}${COLORS.RESET}`);
  process.exit(1);
}

const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
let issues = 0;

// ============================================================================
// 1. Check for Vulnerable Packages
// ============================================================================
console.log(`${COLORS.BLUE}[1] Checking for known vulnerabilities...${COLORS.RESET}`);
for (const [pkg, info] of Object.entries(VULNERABLE_PACKAGES)) {
  if (dependencies[pkg]) {
    const version = dependencies[pkg].replace(/^[\^~]/, '');
    console.log(`  ${COLORS.YELLOW}⚠${COLORS.RESET} ${pkg}@${version} - ${info.reason}`);
    console.log(`     Update to: ${pkg}@${info.min} or higher`);
    issues++;
  }
}
if (Object.keys(VULNERABLE_PACKAGES).every(pkg => !dependencies[pkg])) {
  console.log(`${COLORS.GREEN}✓ No known vulnerable packages found${COLORS.RESET}`);
}

// ============================================================================
// 2. Count Dependencies
// ============================================================================
console.log('');
console.log(`${COLORS.BLUE}[2] Dependency count analysis...${COLORS.RESET}`);
const depCount = Object.keys(packageJson.dependencies || {}).length;
const devDepCount = Object.keys(packageJson.devDependencies || {}).length;
console.log(`  Production dependencies: ${depCount}`);
console.log(`  Development dependencies: ${devDepCount}`);
if (depCount > 30) {
  console.log(`  ${COLORS.YELLOW}⚠ High number of production dependencies (${depCount})${COLORS.RESET}`);
  console.log(`     Consider reducing dependencies for smaller bundle size and fewer vulnerabilities`);
  issues++;
} else {
  console.log(`  ${COLORS.GREEN}✓ Reasonable dependency count${COLORS.RESET}`);
}

// ============================================================================
// 3. Check for Heavy Packages
// ============================================================================
console.log('');
console.log(`${COLORS.BLUE}[3] Checking for heavy/bloated packages...${COLORS.RESET}`);
const heavyWarnings = [];
for (const heavy of BEST_PRACTICES.dependencies.heavy) {
  if (packageJson.dependencies && packageJson.dependencies[heavy]) {
    heavyWarnings.push(heavy);
  }
}
if (heavyWarnings.length > 0) {
  console.log(`  ${COLORS.YELLOW}⚠ Heavy packages in production:${COLORS.RESET}`);
  for (const pkg of heavyWarnings) {
    console.log(`     - ${pkg}`);
  }
  console.log(`     Consider using lighter alternatives or bundling strategies`);
  issues++;
} else {
  console.log(`${COLORS.GREEN}✓ No heavy packages detected in production${COLORS.RESET}`);
}

// ============================================================================
// 4. Check for Security Tools
// ============================================================================
console.log('');
console.log(`${COLORS.BLUE}[4] Checking for security best practices...${COLORS.RESET}`);
let securityTools = 0;
const hasEslint = packageJson.devDependencies && packageJson.devDependencies.eslint;
const hasEslintSecurity = packageJson.devDependencies && packageJson.devDependencies['eslint-plugin-security'];
const hasPrettier = packageJson.devDependencies && packageJson.devDependencies.prettier;
const hasHelmet = packageJson.dependencies && packageJson.dependencies.helmet;

if (hasEslint) {
  console.log(`  ${COLORS.GREEN}✓${COLORS.RESET} ESLint configured`);
  securityTools++;
} else {
  console.log(`  ${COLORS.YELLOW}⚠ ESLint not found${COLORS.RESET}`);
}

if (hasEslintSecurity) {
  console.log(`  ${COLORS.GREEN}✓${COLORS.RESET} eslint-plugin-security configured`);
  securityTools++;
} else {
  console.log(`  ${COLORS.YELLOW}⚠ eslint-plugin-security not found${COLORS.RESET}`);
  issues++;
}

if (hasPrettier) {
  console.log(`  ${COLORS.GREEN}✓${COLORS.RESET} Prettier configured for code formatting`);
  securityTools++;
} else {
  console.log(`  ${COLORS.YELLOW}⚠ Prettier not found (recommended for code consistency)${COLORS.RESET}`);
}

if (packageJson.dependencies && packageJson.dependencies.dotenv) {
  console.log(`  ${COLORS.GREEN}✓${COLORS.RESET} dotenv configured for env vars`);
  securityTools++;
} else {
  console.log(`  ${COLORS.YELLOW}⚠ dotenv not found (needed for safe env var handling)${COLORS.RESET}`);
}

// ============================================================================
// 5. Check package.json Scripts
// ============================================================================
console.log('');
console.log(`${COLORS.BLUE}[5] Checking package.json scripts...${COLORS.RESET}`);
const scripts = packageJson.scripts || {};
if (scripts.audit) {
  console.log(`  ${COLORS.GREEN}✓${COLORS.RESET} npm audit script configured`);
} else {
  console.log(`  ${COLORS.YELLOW}⚠ npm audit script missing${COLORS.RESET}`);
  console.log(`     Add:  "audit": "npm audit"  to scripts${COLORS.RESET}`);
}

if (scripts['audit:fix']) {
  console.log(`  ${COLORS.GREEN}✓${COLORS.RESET} npm audit:fix script configured`);
} else {
  console.log(`  ${COLORS.YELLOW}⚠ npm audit:fix script missing${COLORS.RESET}`);
}

if (scripts.lint) {
  console.log(`  ${COLORS.GREEN}✓${COLORS.RESET} Lint script configured`);
} else {
  console.log(`  ${COLORS.YELLOW}⚠ Lint script missing${COLORS.RESET}`);
  issues++;
}

// ============================================================================
// 6. Check .npmrc Configuration
// ============================================================================
console.log('');
console.log(`${COLORS.BLUE}[6] Checking .npmrc configuration...${COLORS.RESET}`);
const npmrcPath = path.join(process.cwd(), '.npmrc');
if (fs.existsSync(npmrcPath)) {
  const npmrc = fs.readFileSync(npmrcPath, 'utf8');
  if (npmrc.includes('audit=true')) {
    console.log(`  ${COLORS.GREEN}✓${COLORS.RESET} npm audit enabled in .npmrc`);
  } else {
    console.log(`  ${COLORS.YELLOW}⚠ npm audit not enabled${COLORS.RESET}`);
  }
  if (npmrc.includes('audit-level=high')) {
    console.log(`  ${COLORS.GREEN}✓${COLORS.RESET} High audit-level configured`);
  } else {
    console.log(`  ${COLORS.YELLOW}⚠ audit-level not set to high${COLORS.RESET}`);
    issues++;
  }
} else {
  console.log(`  ${COLORS.YELLOW}⚠ .npmrc not found${COLORS.RESET}`);
  console.log(`     Create with: audit=true and audit-level=high${COLORS.RESET}`);
  issues++;
}

// ============================================================================
// Summary
// ============================================================================
console.log('');
console.log(`${COLORS.BLUE}╔══════════════════════════════════════════════════════╗${COLORS.RESET}`);
console.log(`${COLORS.BLUE}║ Dependency Check Summary                             ║${COLORS.RESET}`);
console.log(`${COLORS.BLUE}╚══════════════════════════════════════════════════════╝${COLORS.RESET}`);
console.log('');

if (issues === 0) {
  console.log(`${COLORS.GREEN}✓ All dependency checks PASSED${COLORS.RESET}`);
  console.log('');
  console.log('✓ No known vulnerable packages');
  console.log('✓ Reasonable dependency count');
  console.log('✓ Security tools configured');
  console.log('✓ Best practices followed');
} else {
  console.log(`${COLORS.YELLOW}⚠ Found ${issues} issue(s)${COLORS.RESET}`);
  console.log('');
  console.log('Recommended actions:');
  console.log('  1. Run: npm audit');
  console.log('  2. Run: npm audit fix');
  console.log('  3. Update vulnerable packages manually if needed');
  console.log('  4. Review SECURITY.md for dependency best practices');
}

console.log('');
process.exit(issues > 0 ? 1 : 0);
