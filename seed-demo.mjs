/**
 * Demo data seeder for the Vessa admin. Populates the modules that were empty
 * by calling the real API as the business owner (approval-gated flows included).
 *
 * Usage: node seed-demo.mjs   (backend must be running on :3000)
 *
 * Guards: every block checks the current count first and skips if data exists,
 * so the script is safe to re-run.
 */
const BASE = 'http://localhost:3000/api/v1';
const OWNER = { email: 'owner@seentair.test', password: 'Password123!' };
const DAY = 86400000;
const now = Date.now();

let token = '';

async function api(method, path, body, isForm = false) {
  const headers = { Authorization: `Bearer ${token}` };
  if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-json */ }
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 200)}`);
  }
  return json;
}

const log = (msg) => console.log(msg);
const fail = (msg) => { console.error(`! ${msg}`); };

async function approved(actionType, payload) {
  const req = await api('POST', '/approvals', { actionType, payload });
  // The business owner self-approves on creation; decide() would 403.
  if (req.status !== 'approved') {
    await api('POST', `/approvals/${req.id}/decide`, { decision: 'approved' });
  }
  return req.id;
}

async function count(path) {
  const r = await api('GET', path);
  if (Array.isArray(r)) return r.length;
  if (r && typeof r.total === 'number') return r.total;
  if (r && Array.isArray(r.data)) return r.data.length;
  return 0;
}

// ---------------------------------------------------------------- suppliers
async function seedSuppliers() {
  if (await count('/materials/suppliers') > 0) return log('suppliers: present, skipping');
  const rows = [
    { name: 'Aba Textile Union', category: 'fabrics', location: 'Aba, Abia State', certified: true, slaScore: 92, quotaUnits: 5000, complianceNotes: 'Aba loomed cotton, 280GSM certified lots.' },
    { name: 'Lagos Trim House', category: 'trims_hardware', location: 'Lagos Island', certified: true, slaScore: 88, quotaUnits: 1200, complianceNotes: 'YKK zips, nickel-free hardware.' },
    { name: 'Kano Dye Works', category: 'thread', location: 'Kano', certified: false, slaScore: 74, quotaUnits: 800, complianceNotes: 'Reactive dyes, batch variance noted.' },
  ];
  for (const s of rows) await api('POST', '/materials/suppliers', s);
  log(`suppliers: created ${rows.length}`);
}

// ---------------------------------------------------------------- materials
async function seedMaterials() {
  const existing = await api('GET', '/materials');
  if (existing.length > 0) {
    log('materials: present, skipping');
    return existing;
  }
  const rows = [
    { name: 'Aba loomed cotton 280GSM', unit: 'yard', category: 'fabrics', storageLocation: 'C3-R1', reorderThreshold: 120 },
    { name: 'Heavyweight French terry', unit: 'yard', category: 'fabrics', storageLocation: 'C3-R2', reorderThreshold: 90 },
    { name: 'Merrow thread - charcoal', unit: 'cone', category: 'thread', storageLocation: 'B1-R4', reorderThreshold: 40 },
    { name: 'Dust bags - kraft', unit: 'piece', category: 'packaging', storageLocation: 'A2-R1', reorderThreshold: 200 },
  ];
  const out = [];
  for (const m of rows) out.push(await api('POST', '/materials', m));
  log(`materials: created ${out.length}`);
  return out;
}

// ---------------------------------------------------------------- purchases
async function seedPurchases(materials) {
  if (await count('/materials/purchases?page=1&limit=10') > 0) return log('purchases: present, skipping');
  const purchases = [
    { material: 0, quantity: 400, cost: 4200, note: 'Drop 05 base cloth', supplierName: 'Aba Textile Union', leadTimeDays: 7 },
    { material: 1, quantity: 250, cost: 5100, note: 'Hood + jogger run', supplierName: 'Aba Textile Union', leadTimeDays: 10 },
    { material: 3, quantity: 600, cost: 180, note: 'Shipping supplies', supplierName: 'Lagos Trim House', leadTimeDays: 3 },
  ];
  for (const p of purchases) {
    const approvalId = await approved('purchasing', { materialId: materials[p.material].id, quantity: p.quantity, cost: p.cost });
    await api('POST', `/materials/${materials[p.material].id}/purchase`, {
      quantity: p.quantity,
      cost: p.cost,
      note: p.note,
      supplierName: p.supplierName,
      leadTimeDays: p.leadTimeDays,
      approvalRequestId: approvalId,
    });
  }
  log(`purchases: created ${purchases.length} (approval-gated)`);
}

// ---------------------------------------------------------- production batch
async function seedProduction() {
  if (await count('/production-batches?page=1&limit=10') > 0) return log('production: present, skipping');
  const products = (await api('GET', '/products?page=1&limit=50')).data;
  const stock = products
    .flatMap((p) => p.variants.map((v) => ({ id: v.id, sku: v.sku, name: p.name })))
    .filter((v) => !/BSP/.test(v.sku))
    .slice(0, 3);
  for (const v of stock) {
    const approvalId = await approved('production_start', { variantId: v.id });
    const batch = await api('POST', '/production-batches', {
      variantId: v.id,
      quantity: 25 + Math.floor(Math.random() * 30),
      plannedDate: new Date(now + 2 * DAY).toISOString(),
      approvalRequestId: approvalId,
    });
    await api('PATCH', `/production-batches/${batch.id}/stage`, { stage: 'Cutting' }).catch(() => {});
  }
  log(`production: created ${stock.length} batches at Cutting`);
}

// ------------------------------------------------------------- ledger entries
async function seedLedger() {
  const ledger = (await api('GET', '/accounting/ledger?page=1&limit=100')).data;
  if (ledger.some((e) => e.category === 'Atelier payroll - October')) {
    return log('ledger: manual entries present, skipping');
  }
  const entries = [
    { type: 'expense', amount: 450000, category: 'Machinery maintenance' },
    { type: 'payroll', amount: 1850000, category: 'Atelier payroll - October' },
    { type: 'investment', amount: 5000000, category: 'Partner capital injection' },
  ];
  for (const e of entries) {
    const approvalId = await approved('fund_movement', { type: e.type, amount: e.amount });
    await api('POST', '/accounting/ledger', { ...e, approvalRequestId: approvalId });
  }
  log(`ledger: created ${entries.length} entries (approval-gated)`);
}

// ------------------------------------------------------------------- partners
async function seedPartners() {
  if (await count('/partners') > 0) return log('partners: present, skipping');
  const users = (await api('GET', '/users?page=1&limit=50')).data;
  const partnerUser = users.find((u) => u.role?.name === 'partner_investor');
  if (!partnerUser) return fail('no partner_investor user found');
  await api('POST', '/partners', { userId: partnerUser.id, equityPercentage: 12.5, investedAmount: 5000000 });
  const approvalId = await approved('fund_movement', { period: '2026-Q3' });
  await api('POST', '/profit-distributions', { period: '2026-Q3', totalProfit: 1200000, approvalRequestId: approvalId });
  log('partners: 1 partner + 1 distribution created');
}

// ----------------------------------------------------------------- campaigns
async function seedCampaigns() {
  if (await count('/campaigns') > 0) return log('campaigns: present, skipping');
  const rows = [
    { name: 'Drop 05 Launch', type: 'campaign', channel: 'instagram', discountPercent: 10, startDate: new Date(now - 5 * DAY).toISOString(), endDate: new Date(now + 9 * DAY).toISOString() },
    { name: 'Lagos Pop-up Weekend', type: 'promotion', channel: 'popup', startDate: new Date(now + 12 * DAY).toISOString(), endDate: new Date(now + 14 * DAY).toISOString() },
    { name: 'Returning Buyer Boost', type: 'loyalty', channel: 'email', startDate: new Date(now - 20 * DAY).toISOString(), endDate: new Date(now + 40 * DAY).toISOString() },
  ];
  for (const c of rows) await api('POST', '/campaigns', c);
  log(`campaigns: created ${rows.length}`);
}

// ------------------------------------------------------------------- coupons
async function seedCoupons() {
  const existing = await api('GET', '/coupons/admin/coupons');
  const reason = 'Demo seeding';
  let couponId;
  let c2Id;
  if (existing.length > 0) {
    log('coupons: present, skipping creation');
    couponId = existing[0].id;
    c2Id = (existing.find((c) => c.name === 'Free delivery - Aba pickup') ?? existing[0]).id;
  } else {
    const c1 = await api('POST', '/coupons/admin/coupons', {
      name: 'Drop 05 early access',
      description: '10% off for the launch weekend.',
      type: 'percent_off',
      value: 10,
      maxDiscount: 15000,
      minSpend: 40000,
      startsAt: new Date(now - 2 * DAY).toISOString(),
      expiresAt: new Date(now + 12 * DAY).toISOString(),
      usageCap: 200,
      perCustomerCap: 1,
      audience: 'all',
      reason,
    });
    const c2 = await api('POST', '/coupons/admin/coupons', {
      name: 'Free delivery - Aba pickup',
      description: 'Waives delivery for the Aba pickup point.',
      type: 'free_delivery',
      value: 0,
      audience: 'all',
      reason,
    });
    couponId = c1.coupon.id;
    c2Id = c2.coupon.id;
  }
  if ((await api('GET', '/coupons/admin/campaigns')).length === 0) {
    await api('POST', '/coupons/admin/campaigns', {
      headline: 'Early access: Drop 05',
      badgeText: 'NEW DROP',
      offerText: '10% off launch weekend orders over ₦40,000.',
      labelText: 'SEENTAIR10',
      startsAt: new Date(now - 2 * DAY).toISOString(),
      endsAt: new Date(now + 12 * DAY).toISOString(),
      claimKind: 'coupon',
      couponId,
      placement: 'home_top',
      reason,
    });
  }
  // The coupon wallet FKs to users, not customer profiles: issue to
  // customer-role users from /users (customer profiles live in another table).
  const users = (await api('GET', '/users?page=1&limit=100')).data;
  const ids = users.filter((u) => u.role?.name === 'customer').slice(0, 3).map((u) => u.id);
  if (ids.length && couponId && c2Id) {
    await api('POST', `/coupons/admin/coupons/${couponId}/issue`, { customerIds: ids, reason }).catch((e) => fail(`issue c1: ${e.message}`));
    await api('POST', `/coupons/admin/coupons/${c2Id}/issue`, { customerIds: ids.slice(0, 2), reason }).catch((e) => fail(`issue c2: ${e.message}`));
  }
  log(`coupons: campaigns ensured, issued to ${ids.length} customers`);
}

// ------------------------------------------------------------- help tickets
async function seedTickets() {
  if (await count('/help/tickets?page=1&limit=10') > 0) return log('tickets: present, skipping');
  const t1 = await api('POST', '/help/tickets', { subject: 'Can I change the delivery address after paying?', description: 'I ordered the Utility Jogger and want it sent to my office instead.' });
  await api('POST', '/help/tickets', { subject: 'Do you restock sold-out sizes?', description: 'The Aba Proto Tee in XXL black is sold out. Will it come back?' });
  await api('PATCH', `/help/tickets/${t1.id}/status`, { status: 'resolved' }).catch(() => {});
  log('tickets: created 2 (one resolved)');
}

// -------------------------------------------------------- delivery + return
async function seedLogisticsAndReturns() {
  const orders = (await api('GET', '/orders?page=1&limit=10')).data;
  const target = orders.find((o) => o.items?.length);

  if ((await count('/deliveries')) === 0 && target) {
    await api('POST', '/deliveries', {
      orderId: target.id,
      carrier: 'GIG Logistics',
      legNumber: 1,
      weightKg: 3.4,
      zone: 'south-east',
      contents: target.items.slice(0, 2).map((i) => ({ sku: i.variant.sku, quantity: i.quantity })),
      driverName: 'Chidi Okafor',
      driverPhone: '+2348030000001',
    });
    log('deliveries: created 1 consignment');
  } else {
    log('deliveries: present, skipping');
  }

  if ((await count('/returns?page=1&limit=10')) === 0 && target) {
    // Only the ordering customer can open a return - sign in as them.
    const customerEmail = target.customer?.email;
    let customerToken = null;
    if (customerEmail) {
      const res = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: customerEmail, password: OWNER.password }),
      });
      if (res.ok) customerToken = (await res.json()).accessToken;
    }
    if (customerToken) {
      const item = target.items[0];
      const res = await fetch(`${BASE}/returns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({
          orderId: target.id,
          variantId: item.variant.id,
          quantity: 1,
          reason: 'Size runs small',
          trackingNumber: 'RET-DEMO-0001',
        }),
      });
      if (res.ok) log('returns: created 1 (pending review)');
      else fail(`return create -> ${res.status}`);
    } else {
      fail('no customer credentials for the order; return skipped');
    }
  } else {
    log('returns: present, skipping');
  }
}

// --------------------------------------------------------- wholesale account
async function seedWholesaleApplication() {
  const accounts = await api('GET', '/wholesale/accounts?page=1&limit=50');
  const list = Array.isArray(accounts) ? accounts : accounts.data;
  const pending = list.filter((a) => a.status === 'pending');
  if (pending.length) return log('wholesale applications: present, skipping');
  const res = await fetch(`${BASE}/wholesale/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Adaeze Umeh',
      email: `adaeze${Date.now()}@example.com`,
      password: 'Password123!',
      businessName: ' thread & grain concept store',
      buyerType: 'retailer',
      businessPhone: '+2348090000002',
      city: 'Enugu',
      state: 'Enugu',
      openingVolume: 150,
    }),
  });
  if (res.ok) log('wholesale: 1 pending application created');
  else fail(`wholesale apply -> ${res.status}`);
}

// -------------------------------------------------------------------- media
// Note: the media library page is session-only by design (no list endpoint),
// so uploads happen live in the demo. Nothing to seed.

// ---------------------------------------------------------------------- main
const loginRes = await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(OWNER),
});
if (!loginRes.ok) { console.error(`login failed: ${loginRes.status}`); process.exit(1); }
token = (await loginRes.json()).accessToken;
log(`signed in as ${OWNER.email}`);

const steps = [seedSuppliers, seedProduction, seedLedger, seedPartners, seedCampaigns, seedCoupons, seedTickets, seedLogisticsAndReturns, seedWholesaleApplication];

const materials = await seedMaterials().catch((e) => { fail(`seedMaterials: ${e.message}`); return []; });
try { await seedPurchases(materials); } catch (e) { fail(`seedPurchases: ${e.message}`); }

for (const step of steps) {
  try {
    await step();
  } catch (e) {
    fail(`${step.name}: ${e.message}`);
  }
}

log('--- post-seed counts ---');
for (const [label, path] of [
  ['suppliers', '/materials/suppliers'],
  ['materials', '/materials'],
  ['purchases', '/materials/purchases?page=1&limit=10'],
  ['production', '/production-batches?page=1&limit=10'],
  ['ledger', '/accounting/ledger?page=1&limit=10'],
  ['partners', '/partners'],
  ['campaigns', '/campaigns'],
  ['coupons', '/coupons/admin/coupons'],
  ['coupon campaigns', '/coupons/admin/campaigns'],
  ['tickets', '/help/tickets?page=1&limit=10'],
  ['deliveries', '/deliveries'],
  ['returns', '/returns?page=1&limit=10'],
  ['wholesale accounts', '/wholesale/accounts?page=1&limit=50'],
]) {
  try { log(`${label}: ${await count(path)}`); } catch { fail(`${label}: endpoint error`); }
}
process.exit(0);
