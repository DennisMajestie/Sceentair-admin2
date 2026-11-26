#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const indexPath = path.join(__dirname, '..', 'src', 'index.html');
// The app always talks to the relative /api/v1 path: locally the Angular dev
// proxy (proxy.conf.json) forwards it, on Vercel vercel.json rewrites it to the
// Render API. Same-origin requests keep the httpOnly refresh cookie first-party,
// which is the only way it survives browsers that block third-party cookies.
// VESSA_API_BASE_URL overrides for a non-Vercel deployment that cannot proxy,
// but it is ignored on Vercel: an absolute API origin there makes the refresh
// cookie third-party and signs the user out on every reload.
const isVercel = !!process.env.VERCEL;
const apiBaseUrl = (isVercel ? '' : process.env.VESSA_API_BASE_URL) || '/api/v1';
// The websocket upgrade cannot ride the HTTP rewrite, so it keeps the direct
// API origin (Render in production, the API dev server locally).
const realtimeUrl =
  process.env.VESSA_REALTIME_URL ||
  (isVercel ? 'https://seentair-backend.onrender.com' : 'http://localhost:3000');

const storefrontUrl =
  process.env.VESSA_STOREFRONT_URL ||
  (isVercel ? 'https://seent-air-fashion.vercel.app' : 'http://localhost:4200');

let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/apiBaseUrl:\s*'[^']*'/, `apiBaseUrl: '${apiBaseUrl}'`);
html = html.replace(/realtimeUrl:\s*'[^']*'/, `realtimeUrl: '${realtimeUrl}'`);
html = html.replace(/storefrontUrl:\s*'[^']*'/, `storefrontUrl: '${storefrontUrl}'`);
fs.writeFileSync(indexPath, html, 'utf8');

console.log(
  `[inject-api-url] Set VESSA_CONFIG.apiBaseUrl = ${apiBaseUrl}` +
    (isVercel ? ' (Vercel: same-origin, env override ignored)' : process.env.VESSA_API_BASE_URL ? ' (VESSA_API_BASE_URL)' : ' (relative default)') +
    `, realtimeUrl = ${realtimeUrl}` +
    (process.env.VESSA_REALTIME_URL ? ' (VESSA_REALTIME_URL)' : isVercel ? ' (Vercel default)' : ' (local default)') +
    `, storefrontUrl = ${storefrontUrl}`,
);
