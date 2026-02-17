#!/usr/bin/env node

/**
 * LTI 1.1 Tool Provider Stub
 *
 * A zero-dependency Node.js server that acts as a fake LTI 1.1 Tool Provider.
 * It receives LTI launch POSTs, validates the OAuth 1.0a signature, and
 * renders all launch parameters in a styled HTML page for debugging.
 *
 * Usage:
 *   node scripts/lti11-tool-stub.mjs                          # defaults: port 9001, key=test, secret=secret
 *   node scripts/lti11-tool-stub.mjs --port 8888              # custom port
 *   node scripts/lti11-tool-stub.mjs --key mykey --secret s3c  # custom OAuth credentials
 *
 * Then register the tool in the broker with:
 *   baseUrl:  http://localhost:9001/lti/launch
 *   protocol: LTI11
 *   key:      test
 *   secret:   secret
 */

import { createServer } from 'node:http'
import { createHmac } from 'node:crypto'
import { URL, URLSearchParams } from 'node:url'

// ─── CLI Args ─────────────────────────────────────────────────
const args = process.argv.slice(2)
function getArg(name, fallback) {
  const idx = args.indexOf(`--${name}`)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback
}

const PORT = parseInt(getArg('port', '9001'), 10)
const CONSUMER_KEY = getArg('key', 'test')
const CONSUMER_SECRET = getArg('secret', 'secret')

// ─── OAuth 1.0a Signature Verification ────────────────────────
function percentEncode(str) {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
}

function buildBaseString(method, url, params) {
  // Sort parameters alphabetically by key, then by value
  const sorted = [...params].sort((a, b) =>
    a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])
  )
  const paramString = sorted.map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`).join('&')

  return `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramString)}`
}

function verifyOAuthSignature(method, url, params, consumerSecret) {
  // Extract and remove the signature from params
  const receivedSig = params.get('oauth_signature')
  if (!receivedSig) return { valid: false, reason: 'Missing oauth_signature' }

  const paramsWithoutSig = new URLSearchParams(params)
  paramsWithoutSig.delete('oauth_signature')

  const baseString = buildBaseString(method, url, paramsWithoutSig)
  const signingKey = `${percentEncode(consumerSecret)}&` // token secret is empty for LTI

  const expectedSig = createHmac('sha1', signingKey).update(baseString).digest('base64')

  return {
    valid: receivedSig === expectedSig,
    reason: receivedSig === expectedSig ? 'Signature valid ✓' : 'Signature mismatch ✗',
    expected: expectedSig,
    received: receivedSig,
    baseString
  }
}

// ─── HTML Renderer ────────────────────────────────────────────
function renderPage(params, sigResult, requestUrl) {
  const ltiParams = []
  const oauthParams = []
  const customParams = []
  const otherParams = []

  for (const [key, value] of [...params].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (key.startsWith('oauth_')) oauthParams.push([key, value])
    else if (key.startsWith('custom_')) customParams.push([key, value])
    else if (
      key.startsWith('lti_') ||
      key.startsWith('launch_') ||
      key.startsWith('lis_') ||
      key.startsWith('resource_link') ||
      key.startsWith('context_') ||
      key.startsWith('tool_consumer') ||
      key === 'lti_message_type' ||
      key === 'lti_version' ||
      key === 'roles' ||
      key === 'user_id' ||
      key === 'user_image'
    ) {
      ltiParams.push([key, value])
    } else {
      otherParams.push([key, value])
    }
  }

  const makeRows = (pairs) =>
    pairs
      .map(
        ([k, v]) =>
          `<tr><td class="key">${escapeHtml(k)}</td><td class="val">${escapeHtml(v)}</td></tr>`
      )
      .join('\n')

  const sigClass = sigResult.valid ? 'valid' : 'invalid'
  const sigIcon = sigResult.valid ? '✅' : '❌'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LTI 1.1 Launch Inspector</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a; color: #e2e8f0; margin: 0; padding: 2rem;
    }
    h1 { color: #38bdf8; margin-bottom: 0.25rem; }
    .subtitle { color: #64748b; margin-bottom: 2rem; font-size: 0.9rem; }
    .sig-badge {
      display: inline-block; padding: 0.5rem 1rem; border-radius: 0.5rem;
      font-weight: 600; margin-bottom: 1.5rem; font-size: 1rem;
    }
    .sig-badge.valid { background: #064e3b; color: #6ee7b7; border: 1px solid #10b981; }
    .sig-badge.invalid { background: #7f1d1d; color: #fca5a5; border: 1px solid #ef4444; }
    details { margin-bottom: 1.5rem; }
    summary {
      cursor: pointer; font-size: 1.1rem; font-weight: 600; color: #94a3b8;
      padding: 0.5rem 0; border-bottom: 1px solid #1e293b;
    }
    summary:hover { color: #e2e8f0; }
    table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
    td { padding: 0.4rem 0.75rem; border-bottom: 1px solid #1e293b; font-size: 0.85rem; vertical-align: top; }
    .key { color: #38bdf8; font-family: 'SF Mono', Menlo, monospace; white-space: nowrap; width: 30%; }
    .val { color: #cbd5e1; word-break: break-all; }
    .base-string { background: #1e293b; padding: 1rem; border-radius: 0.5rem; overflow-x: auto;
      font-family: monospace; font-size: 0.75rem; color: #94a3b8; word-break: break-all; margin-top: 0.5rem; }
    .meta { color: #475569; font-size: 0.8rem; margin-top: 2rem; }
  </style>
</head>
<body>
  <h1>🔧 LTI 1.1 Launch Inspector</h1>
  <p class="subtitle">Received POST to <code>${escapeHtml(requestUrl)}</code></p>

  <div class="sig-badge ${sigClass}">${sigIcon} ${escapeHtml(sigResult.reason)}</div>

  ${
    !sigResult.valid && sigResult.baseString
      ? `<details open>
    <summary>🔑 Signature Debug</summary>
    <table>
      <tr><td class="key">Received</td><td class="val">${escapeHtml(sigResult.received || '')}</td></tr>
      <tr><td class="key">Expected</td><td class="val">${escapeHtml(sigResult.expected || '')}</td></tr>
    </table>
    <div class="base-string">${escapeHtml(sigResult.baseString)}</div>
  </details>`
      : ''
  }

  <details open>
    <summary>📋 LTI Parameters (${ltiParams.length})</summary>
    <table>${makeRows(ltiParams)}</table>
  </details>

  <details>
    <summary>🔐 OAuth Parameters (${oauthParams.length})</summary>
    <table>${makeRows(oauthParams)}</table>
  </details>

  ${
    customParams.length
      ? `<details open>
    <summary>⚙️ Custom Parameters (${customParams.length})</summary>
    <table>${makeRows(customParams)}</table>
  </details>`
      : ''
  }

  ${
    otherParams.length
      ? `<details>
    <summary>📦 Other Parameters (${otherParams.length})</summary>
    <table>${makeRows(otherParams)}</table>
  </details>`
      : ''
  }

  <p class="meta">LTI 1.1 Tool Stub &middot; Consumer Key: <code>${escapeHtml(CONSUMER_KEY)}</code> &middot; ${new Date().toISOString()}</p>
</body>
</html>`
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ─── HTTP Server ──────────────────────────────────────────────
const server = createServer((req, res) => {
  // Landing page for GET requests
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(`<!DOCTYPE html>
<html><head><title>LTI 1.1 Tool Stub</title>
<style>
  body { font-family: system-ui; background: #0f172a; color: #e2e8f0; display: flex;
    align-items: center; justify-content: center; height: 100vh; margin: 0; }
  .card { text-align: center; background: #1e293b; padding: 3rem; border-radius: 1rem; }
  h1 { color: #38bdf8; } code { background: #0f172a; padding: 0.2rem 0.5rem; border-radius: 0.25rem; }
</style></head><body>
<div class="card">
  <h1>🔧 LTI 1.1 Tool Stub</h1>
  <p>Waiting for LTI launch POST…</p>
  <p>Launch URL: <code>http://localhost:${PORT}/lti/launch</code></p>
  <p>Consumer Key: <code>${escapeHtml(CONSUMER_KEY)}</code></p>
</div>
</body></html>`)
    return
  }

  // Handle LTI launch POST
  if (req.method === 'POST') {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      const params = new URLSearchParams(body)

      // Build the canonical URL (without query string)
      const requestUrl = `http://localhost:${PORT}${req.url?.split('?')[0] || '/lti/launch'}`

      // Check consumer key
      const receivedKey = params.get('oauth_consumer_key')
      if (receivedKey !== CONSUMER_KEY) {
        console.log(`⚠️  Unknown consumer key: ${receivedKey} (expected: ${CONSUMER_KEY})`)
      }

      // Verify OAuth signature
      const sigResult = verifyOAuthSignature('POST', requestUrl, params, CONSUMER_SECRET)

      // Log to console
      const timestamp = new Date().toLocaleTimeString()
      console.log(`\n${sigResult.valid ? '✅' : '❌'} [${timestamp}] LTI Launch received`)
      console.log(
        `   User:    ${params.get('lis_person_name_full') || params.get('user_id') || 'unknown'}`
      )
      console.log(
        `   Course:  ${params.get('context_title') || params.get('context_id') || 'unknown'}`
      )
      console.log(`   Role:    ${params.get('roles') || 'unknown'}`)
      console.log(`   Sig:     ${sigResult.reason}`)

      // Render HTML response
      const html = renderPage(params, sigResult, requestUrl)
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(html)
    })
    return
  }

  res.writeHead(405, { 'Content-Type': 'text/plain' })
  res.end('Method Not Allowed')
})

server.listen(PORT, () => {
  console.log(`
┌────────────────────────────────────────────────────┐
│  🔧  LTI 1.1 Tool Provider Stub                   │
├────────────────────────────────────────────────────┤
│                                                    │
│  Launch URL:     http://localhost:${String(PORT).padEnd(5)}            │
│  Path:           /lti/launch                       │
│  Consumer Key:   ${CONSUMER_KEY.padEnd(33)}│
│  Consumer Secret:${(' ' + CONSUMER_SECRET).padEnd(34)}│
│                                                    │
│  Register this tool in the broker with:            │
│    baseUrl:  http://localhost:${String(PORT).padEnd(5)}             │
│    protocol: LTI11                                 │
│    key:      ${CONSUMER_KEY.padEnd(38)}│
│    secret:   ${CONSUMER_SECRET.padEnd(38)}│
│                                                    │
└────────────────────────────────────────────────────┘
`)
})
