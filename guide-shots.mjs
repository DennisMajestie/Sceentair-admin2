import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = 'C:\\Users\\charl\\vessa-re\\screenshots\\guide';
fs.mkdirSync(OUT, { recursive: true });

const routes = [
  ['dashboard-overview', '/dashboard/overview'],
  ['dashboard-activity', '/dashboard/activity'],
  ['dashboard-alerts', '/dashboard/alerts'],
  ['products-catalog', '/products/catalog'],
  ['products-batches', '/products/batches'],
  ['products-reviews', '/products/reviews'],
  ['orders-all', '/orders/all'],
  ['orders-board', '/orders/board'],
  ['orders-returns', '/orders/returns'],
  ['orders-deliveries', '/deliveries'],
  ['orders-custom', '/orders/custom'],
  ['messages-inbox', '/messages'],
  ['purchasing-orders', '/purchasing/orders'],
  ['purchasing-materials', '/purchasing/materials'],
  ['purchasing-suppliers', '/purchasing/suppliers'],
  ['production-queue', '/production'],
  ['production-tech-packs', '/production/tech-packs'],
  ['production-kiosk', '/production/kiosk'],
  ['warehouses-inventory', '/warehouses/inventory'],
  ['warehouses-locations', '/warehouses/locations'],
  ['warehouses-counts', '/warehouses/counts'],
  ['customers-shoppers', '/customers/shoppers'],
  ['customers-stockists', '/customers/stockists'],
  ['wholesale-accounts', '/wholesale/accounts'],
  ['wholesale-tiers', '/wholesale/tiers'],
  ['marketing-campaigns', '/marketing/campaigns'],
  ['coupons-wallet', '/coupons/wallet'],
  ['coupons-campaigns', '/coupons/campaigns'],
  ['media-library', '/media'],
  ['finance-ledger', '/accounting/ledger'],
  ['finance-approvals', '/approvals'],
  ['finance-audit', '/audit/log'],
  ['finance-partners', '/partners'],
  ['analytics-overview', '/analytics/overview'],
  ['analytics-sales', '/analytics/sales'],
  ['analytics-stock', '/analytics/stock'],
  ['settings-account', '/settings/account'],
  ['settings-company', '/settings/company'],
  ['settings-team', '/settings/team'],
  ['settings-notifications', '/settings/notifications'],
  ['settings-security', '/settings/security'],
  ['help-center', '/help/center'],
  ['help-tickets', '/help/tickets'],
];

const report = [];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
let consoleIssues = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') consoleIssues.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => consoleIssues.push(`[pageerror] ${e.message}`));

async function login() {
  await page.goto('http://localhost:4200/signin', { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="email"]').fill('owner@seentair.test');
  await page.locator('input[name="password"]').fill('Password123!');
  await page.getByRole('button', { name: /Sign in/ }).click();
  await page.waitForURL('**/dashboard/overview', { timeout: 30000 });
  await page.waitForTimeout(2000);
}

await login();
console.log('Signed in');

for (const [name, route] of routes) {
  consoleIssues = [];
  await page.evaluate((r) => {
    history.pushState(null, '', r);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, route);
  await page.waitForTimeout(2400);
  if (page.url().includes('/signin')) {
    await login();
    await page.evaluate((r) => {
      history.pushState(null, '', r);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, route);
    await page.waitForTimeout(2400);
  }
  const info = await page.evaluate(() => {
    const doc = document.documentElement;
    const vw = window.innerWidth;
    const offenders = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' || cs.position === 'absolute') continue;
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > vw + 2 || r.left < -2) {
        const cls = el.className && el.className.toString ? el.className.toString().slice(0, 70) : '';
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls,
          left: Math.round(r.left),
          right: Math.round(r.right),
        });
        if (offenders.length >= 8) break;
      }
    }
    const h1 = document.querySelector('h1');
    return {
      url: location.pathname,
      h1: h1 ? h1.innerText.trim().replace(/\s+/g, ' ') : null,
      scrollW: doc.scrollWidth,
      clientW: doc.clientWidth,
      overflow: doc.scrollWidth > doc.clientWidth + 2,
      offenders,
    };
  });
  await page.screenshot({ path: `${OUT}\\${name}.png`, fullPage: true });
  report.push({ name, route, ...info, console: [...consoleIssues] });
  console.log(`${name} ${info.overflow ? 'OVERFLOW' : 'ok'} ${info.h1 ?? ''}`);
}

fs.writeFileSync(`${OUT}\\report.json`, JSON.stringify(report, null, 2));
await browser.close();
console.log('DONE');
