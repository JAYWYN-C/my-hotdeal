const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { apiKey, authDomain, projectId, appId } = req.body;

    // Validate inputs
    if (!apiKey || !authDomain || !projectId || !appId) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Save to a temp file for the setup script
    const tempFile = '/tmp/firebase-setup.json';
    fs.writeFileSync(tempFile, JSON.stringify({
      apiKey,
      authDomain,
      projectId,
      appId,
      timestamp: new Date().toISOString()
    }));

    // Queue the setup to run in background
    // (We don't wait for it to complete in the response)
    const setupScript = `
#!/bin/bash
sleep 2
cd /Users/jay/PycharmProjects/vscode/hotdeal

# Read credentials
CREDS=$(cat /tmp/firebase-setup.json)
API_KEY=$(echo $CREDS | jq -r '.apiKey')
AUTH_DOMAIN=$(echo $CREDS | jq -r '.authDomain')
PROJECT_ID=$(echo $CREDS | jq -r '.projectId')
APP_ID=$(echo $CREDS | jq -r '.appId')

# Add to Vercel
npx vercel env add NEXT_PUBLIC_FIREBASE_API_KEY production "$API_KEY" 2>&1 >> /tmp/setup.log
npx vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN production "$AUTH_DOMAIN" 2>&1 >> /tmp/setup.log
npx vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID production "$PROJECT_ID" 2>&1 >> /tmp/setup.log
npx vercel env add NEXT_PUBLIC_FIREBASE_APP_ID production "$APP_ID" 2>&1 >> /tmp/setup.log

# Redeploy
npx vercel --prod --yes 2>&1 >> /tmp/setup.log

# Log completion
echo "Setup complete at $(date)" >> /tmp/setup.log
`;

    fs.writeFileSync('/tmp/run-setup.sh', setupScript);
    fs.chmodSync('/tmp/run-setup.sh', 0o755);

    // Start in background (non-blocking)
    require('child_process').spawn('bash', ['/tmp/run-setup.sh'], {
      detached: true,
      stdio: 'ignore'
    }).unref();

    res.status(200).json({
      success: true,
      message: 'Setup started in background',
      nextStep: 'Check status with: bash check-setup.sh'
    });

  } catch (error) {
    console.error('Setup API error:', error);
    res.status(500).json({
      error: 'Setup failed',
      message: error.message
    });
  }
};
