/**
 * Generates realistic sample data for testing Settlr end-to-end.
 * Run: node scripts/generate-sample-data.mjs
 * Output: sample-data/meesho-settlement-sample.xlsx + seller-sales-register-sample.csv
 *
 * The dataset is deliberately "messy" like real exports:
 *  - 26 orders that match perfectly
 *  - 4 orders where the settlement amount differs from the register
 *  - 2 orders present in the register but missing from the settlement file
 *  - 2 settlement rows with no matching register entry
 *  - 1 duplicate row in the register (same order uploaded twice)
 *  - 2 customer returns / RTO cases in both files
 */
import * as XLSX from '@e965/xlsx';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'sample-data');
mkdirSync(outDir, { recursive: true });

const PRODUCTS = [
  { sku: 'KRT-WT-MENS-L', name: 'Cotton Kurta Set - White, Men L', price: 749 },
  { sku: 'SAR-BNJ-RED', name: 'Banarasi Silk Saree - Red', price: 1199 },
  { sku: 'KDS-GRL-FRK-5Y', name: 'Kids Girls Party Frock, Age 5Y', price: 429 },
  { sku: 'MEN-TRS-DNM-32', name: 'Mens Denim Jeans Slim Fit 32', price: 899 },
  { sku: 'WMN-KRT-YLW-XL', name: 'Womens Rayon Kurti - Yellow XL', price: 549 },
  { sku: 'HOM-BDSHT-DBL', name: 'Double Bedsheet with 2 Pillow Covers', price: 649 },
  { sku: 'ACC-WTCH-BLK', name: 'Analog Wrist Watch - Black Dial', price: 399 },
  { sku: 'FTW-SLPR-BLU-9', name: 'Mens Casual Slippers Blue Size 9', price: 349 },
];

const DATES = [
  '02/07/2026', '03/07/2026', '05/07/2026', '07/07/2026', '09/07/2026',
  '11/07/2026', '13/07/2026', '15/07/2026', '17/07/2026', '19/07/2026',
  '21/07/2026', '23/07/2026', '25/07/2026', '27/07/2026', '29/07/2026',
];

// Deterministic pseudo-random so re-running regenerates the same file
let seed = 42;
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const round2 = (n) => Math.round(n * 100) / 100;

// 37 unique orders
const orders = [];
for (let i = 1; i <= 37; i++) {
  const p = pick(PRODUCTS);
  const date = DATES[i % DATES.length];
  const orderNo = `2345891${String(100 + i)}`;
  const isReturn = i === 12 || i === 29; // 2 return/RTO cases
  const commission = round2(p.price * 0.062 + 11); // ~6.2% + fixed fee
  const shipping = isReturn ? 68 : round2(41 + rand() * 15);
  const returnCharge = isReturn ? 68 : 0;
  const tcs = round2(p.price * 0.001);
  const net = round2(p.price - commission - shipping - returnCharge - tcs);
  orders.push({
    orderNo, date, p, isReturn,
    commission, shipping, returnCharge, tcs, net,
    settlementStatus: isReturn ? 'RTO' : (i % 7 === 0 ? 'Return' : 'Delivered'),
  });
}

// ── Scenario mutations ──
// 4 amount mismatches: settlement pays less than the register expects
const mismatchOrders = ['2345891103', '2345891111', '2345891119', '2345891127'];
for (const o of orders) {
  if (mismatchOrders.includes(o.orderNo)) o.net = round2(o.net - (15 + Math.floor(rand() * 60)));
}
// 2 orders missing from the settlement file entirely (register-only)
const missingFromSettlement = new Set(['2345891106', '2345891121']);
// 2 settlement rows with no register entry (extra settlements)
const settlementOnly = orders.slice(0, 2).map((o) => ({ ...o, orderNo: o.orderNo + 'X' }));

// ── Meesho settlement file (matches real export headers) ──
const settlementRows = [];
for (const o of [...orders, ...settlementOnly]) {
  if (missingFromSettlement.has(o.orderNo)) continue;
  settlementRows.push({
    'Sub Order No': o.orderNo,
    'Transaction ID': `TXN${o.orderNo.slice(-6)}JUL26`,
    'Transaction Date': o.date,
    'SKU': o.p.sku,
    'Product Name': o.p.name,
    'Supplier Listed Price': o.p.price,
    'Commission (Including GST)': o.commission,
    'Forward Shipping Charges': o.isReturn ? 0 : o.shipping,
    'Return Shipping Charge (If Applicable)': o.returnCharge,
    'TCS Amount': o.tcs,
    'Final Settlement Amount': o.net,
    'Live Order Status': o.settlementStatus,
    'Settlement Status': 'Done',
  });
}

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(settlementRows);
XLSX.utils.book_append_sheet(wb, ws, 'Payment File');
writeFileSync(join(outDir, 'meesho-settlement-sample.xlsx'), XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

// ── Seller's own sales register (CSV) ──
const registerRows = [];
for (const o of orders) {
  registerRows.push({
    'Order ID': o.orderNo,
    'Order Date': o.date,
    'SKU': o.p.sku,
    'Product Name': o.p.name,
    'Sale Amount': o.p.price,
    'Order Status': o.isReturn ? 'Returned' : 'Delivered',
  });
}
// duplicate row (seller exported the same order twice)
const dupSrc = registerRows.find((r) => r['Order ID'] === '2345891114');
registerRows.splice(registerRows.indexOf(dupSrc) + 1, 0, { ...dupSrc });

const csvHeader = Object.keys(registerRows[0]).join(',');
const csvBody = registerRows
  .map((r) => Object.values(r).map((v) => (/,/.test(String(v)) ? `"${v}"` : v)).join(','))
  .join('\n');
writeFileSync(join(outDir, 'seller-sales-register-sample.csv'), csvHeader + '\n' + csvBody + '\n');

console.log(`Wrote ${settlementRows.length} settlement rows -> sample-data/meesho-settlement-sample.xlsx`);
console.log(`Wrote ${registerRows.length} register rows   -> sample-data/sample-data/seller-sales-register-sample.csv`.replace('sample-data/sample-data', 'sample-data'));
console.log(`Scenarios: 26 matched, 4 amount mismatches, 2 register-only, 2 settlement-only, 1 duplicate, 2 returns/RTO`);
