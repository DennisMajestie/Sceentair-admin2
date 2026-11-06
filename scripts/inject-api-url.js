#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const indexPath = path.join(__dirname, '..', 'src', 'index.html');
const apiBaseUrl = process.env.VESSA_API_BASE_URL || 'http://localhost:3000/api/v1';

let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/apiBaseUrl:\s*'[^']*'/, `apiBaseUrl: '${apiBaseUrl}'`);
fs.writeFileSync(indexPath, html, 'utf8');

console.log(`[inject-api-url] Set VESSA_CONFIG.apiBaseUrl = ${apiBaseUrl}`);
