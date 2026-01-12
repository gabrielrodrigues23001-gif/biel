const https = require('https');
const { URLSearchParams } = require('url');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const SHEETS_API_HOST = 'sheets.googleapis.com';
const OAUTH_HOST = 'oauth2.googleapis.com';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

const tokenCache = {
  accessToken: null,
  expiresAt: 0
};

let serviceAccountCache = null;

function getEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var ${name}`);
  }
  return value;
}

function loadServiceAccountFromFile() {
  if (serviceAccountCache) return serviceAccountCache;
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) return null;

  const resolvedPath = path.resolve(process.cwd(), credentialsPath);
  const raw = fs.readFileSync(resolvedPath, 'utf8');
  const json = JSON.parse(raw);
  serviceAccountCache = {
    email: json.client_email,
    privateKey: json.private_key
  };
  return serviceAccountCache;
}

function getServiceAccount() {
  const fileAccount = loadServiceAccountFromFile();
  if (fileAccount?.email && fileAccount?.privateKey) {
    return fileAccount;
  }

  const email = getEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const raw = getEnv('GOOGLE_PRIVATE_KEY');
  return {
    email,
    privateKey: raw.replace(/\\n/g, '\n')
  };
}

async function getAccessToken() {
  const now = Date.now();
  if (tokenCache.accessToken && tokenCache.expiresAt > now + 60 * 1000) {
    return tokenCache.accessToken;
  }

  const { email: serviceEmail, privateKey } = getServiceAccount();
  const iat = Math.floor(now / 1000);
  const exp = iat + 3600;

  const assertion = jwt.sign(
    {
      iss: serviceEmail,
      scope: SCOPE,
      aud: `https://${OAUTH_HOST}/token`,
      iat,
      exp
    },
    privateKey,
    { algorithm: 'RS256' }
  );

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion
  }).toString();

  const response = await requestJson(OAUTH_HOST, '/token', 'POST', body, {
    'Content-Type': 'application/x-www-form-urlencoded'
  });

  tokenCache.accessToken = response.access_token;
  tokenCache.expiresAt = now + response.expires_in * 1000;
  return tokenCache.accessToken;
}

function requestJson(host, path, method, body, extraHeaders = {}) {
  const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;

  const headers = {
    ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
    ...extraHeaders
  };

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host,
        path,
        method,
        headers
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = data ? JSON.parse(data) : {};
            if (res.statusCode >= 400) {
              const message = json.error?.message || `HTTP ${res.statusCode}`;
              reject(new Error(message));
              return;
            }
            resolve(json);
          } catch (err) {
            reject(err);
          }
        });
      }
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function sheetsRequest(path, method, body) {
  const accessToken = await getAccessToken();
  return requestJson(SHEETS_API_HOST, path, method, body, {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`
  });
}

function getSpreadsheetId() {
  return getEnv('GOOGLE_SHEETS_ID');
}

async function getSpreadsheetInfo() {
  const spreadsheetId = getSpreadsheetId();
  const path = `/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
  return sheetsRequest(path, 'GET');
}

async function getValues(range) {
  const spreadsheetId = getSpreadsheetId();
  const path = `/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  return sheetsRequest(path, 'GET');
}

async function updateValues(range, values) {
  const spreadsheetId = getSpreadsheetId();
  const path = `/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;
  return sheetsRequest(path, 'PUT', { values });
}

async function appendValues(range, values) {
  const spreadsheetId = getSpreadsheetId();
  const path = `/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  return sheetsRequest(path, 'POST', { values });
}

async function batchUpdate(requests) {
  const spreadsheetId = getSpreadsheetId();
  const path = `/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  return sheetsRequest(path, 'POST', { requests });
}

module.exports = {
  getSpreadsheetInfo,
  getValues,
  updateValues,
  appendValues,
  batchUpdate
};
