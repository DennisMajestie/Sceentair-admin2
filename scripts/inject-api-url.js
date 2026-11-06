#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const indexPath = path.join(__dirname, '..', 'src', 'index.html');
// Local dev talks to the local API. Vercel builds (VERCEL=1) default to the
// production API so a missing env var never deploys localhost by accident.
const isVercel = !!process.env.VERCEL;
const apiBaseUrl =
  process.env.VESSA_API_BASE_URL ||
  (isVercel ? 'https://seentair-backend.onrender.com/api/v1' : 'http://localhost:3000/api/v1');

let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/apiBaseUrl:\s*'[^']*'/, `apiBaseUrl: '${apiBaseUrl}'`);
fs.writeFileSync(indexPath, html, 'utf8');

console.log(
  `[inject-api-url] Set VESSA_CONFIG.apiBaseUrl = ${apiBaseUrl}` +
    (process.env.VESSA_API_BASE_URL ? ' (VESSA_API_BASE_URL)' : isVercel ? ' (Vercel default)' : ' (local default)'),
);
