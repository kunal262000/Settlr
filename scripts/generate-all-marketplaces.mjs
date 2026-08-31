/**
 * Generates realistic sample reconciliation files for Amazon, Flipkart, and Meesho.
 * Each marketplace has:
 *   - A settlement file (what the marketplace paid)
 *   - A seller sales register file (what the seller expects)
 *
 * Scenarios per marketplace:
 *   15 orders that MATCH perfectly
 *    3 orders with AMOUNT_MISMATCH (settlement differs from expected)
 *    2 orders MISSING_SETTLEMENT (in register but not in settlement)
 *    2 orders UNMATCHED_MARKETPLACE_RECORD (in settlement but not in register)
 *    1 duplicate in the seller register
 *    2 return/RTO cases (RETURN_DISCREPANCY)
 *
 * Run: node scripts/generate-all-marketplaces.mjs
 */
import * as XLSX from '@e965/xlsx';
import Papa from 'papaparse';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'sample-data');
mkdirSync(outDir, { recursive: true });

// ── Shared test data ───────────────────────────────────────────────────────────
const PRODUCTS = [
  { sku: 'KRT-WT-MENS-L',  name: 'Cotton Kurta Set - White, Men L',   price: 749  },
  { sku: 'SAR-BNJ-RED',    name: 'Banarasi Silk Saree - Red',           price: 1199 },
  { sku: 'KDS-GRL-FRK-5Y', name: 'Kids Girls Party Frock, Age 5Y',    price: 429  },
  { sku: 'MEN-TRS-DNM-32', name: 'Mens Denim Jeans Slim Fit 32',        price: 899  },
  { sku: 'WMN-KRT-YLW-XL', name: 'Womens Rayon Kurti - Yellow XL',     price: 549  },
  { sku: 'HOM-BDSHT-DBL',  name: 'Double Bedsheet with 2 Pillow Covers',price: 649 },
  { sku: 'ACC-WTCH-BLK',   name: 'Analog Wrist Watch - Black Dial',    price: 399  },
  { sku: 'FTW-SLPR-BLU-9', name: 'Mens Casual Slippers Blue Size 9',   price: 349  },
];

const DATES = [
  '02/07/2026', '03/07/2026', '05/07/2026', '07/07/2026', '09/07/2026',
  '11/07/2026', '13/07/2026', '15/07/2026', '17/07/2026', '19/07/2026',
  '21/07/2026', '23/07/2026', '25/07/2026', '27/07/2026', '29/07/2026',
];

let seed = 42;
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const round2 = (n) => Math.round(n * 100) / 100;

// ── Per-marketplace generators ─────────────────────────────────────────────────

function generateOrders(prefix, n) {
  const orders = [];
  for (let i = 1; i <= n; i++) {
    const p = pick(PRODUCTS);
    const date = DATES[i % DATES.length];
    const orderNo = `${prefix}${String(1000 + i)}`;
    const isReturn = i === 3 || i === 14; // return/RTO cases
    const commission = round2(p.price * 0.062 + 11);
    const shipping  = isReturn ? 68 : round2(41 + rand() * 15);
    const tcs       = round2(p.price * 0.001);
    const net      = round2(p.price - commission - shipping - tcs);
    orders.push({
      orderNo, date, p, isReturn,
      commission, shipping, tcs, net,
      settlementNet: net,  // settlement file value (captured before scenario mutations)
      baseNet: net,       // seller register value (before scenario mutations)
    });
  }
  return orders;
}

function applyScenarios(orders, mismatchIds, missingFromSettlement, settlementOnly) {
  const list = orders.map(o => ({ ...o }));

  // Amount mismatches: settlement pays less (mutate settlementNet, NOT net)
  for (const o of list) {
    if (mismatchIds.has(o.orderNo)) {
      o.settlementNet = round2(o.settlementNet - (20 + Math.floor(rand() * 40)));
    }
  }

  // Returns: seller register shows full amount, settlement shows return deduction
  for (const o of list) {
    if (o.isReturn) {
      // settlement already reflects return (net is lower); register baseNet is the original
      o.baseNet = round2(o.baseNet + (o.settlementNet < 0 ? Math.abs(o.settlementNet) : 0));
    }
  }

  return { list, missingFromSettlement, settlementOnly };
}

// ── Amazon ────────────────────────────────────────────────────────────────────
function writeAmazonSamples(orders, scenarios) {
  const { missingFromSettlement, settlementOnly } = scenarios;

  // Amazon Flat File V2 settlement (long format: one row per fee/price line)
  // Net = Principal - Commission - Shipping - TCS
  const settlementRows = [];
  for (const o of [...orders, ...settlementOnly]) {
    if (missingFromSettlement.has(o.orderNo)) continue;

    const status = o.isReturn ? 'Refund' : 'Order';
    const netCalc = round2(o.p.price - o.commission - o.shipping - o.tcs);
    settlementRows.push({
      'order-id':           o.orderNo,
      'shipment-id':        `SHP${o.orderNo.slice(-4)}`,
      'transaction-type':   status,
      'amount-type':        'ItemPrice',
      'amount-description':  'Principal',
      'amount':             o.p.price,
      'posted-date':        o.date,
    });
    settlementRows.push({
      'order-id':           o.orderNo,
      'shipment-id':        `SHP${o.orderNo.slice(-4)}`,
      'transaction-type':   status,
      'amount-type':        'MarketplaceFee',
      'amount-description': 'Marketplace Facilitation Fee',
      'amount':             -o.commission,
      'posted-date':        o.date,
    });
    settlementRows.push({
      'order-id':           o.orderNo,
      'shipment-id':        `SHP${o.orderNo.slice(-4)}`,
      'transaction-type':   status,
      'amount-type':        'ShippingFee',
      'amount-description': 'Shipping Charge',
      'amount':             -o.shipping,
      'posted-date':        o.date,
    });
    settlementRows.push({
      'order-id':           o.orderNo,
      'shipment-id':        `SHP${o.orderNo.slice(-4)}`,
      'transaction-type':   status,
      'amount-type':        'Tax',
      'amount-description': 'TCS-CGST',
      'amount':             -o.tcs / 2,
      'posted-date':        o.date,
    });
    settlementRows.push({
      'order-id':           o.orderNo,
      'shipment-id':        `SHP${o.orderNo.slice(-4)}`,
      'transaction-type':   status,
      'amount-type':        'Tax',
      'amount-description': 'TCS-IGST',
      'amount':             -o.tcs / 2,
      'posted-date':        o.date,
    });
    settlementRows.push({
      'order-id':           o.orderNo,
      'shipment-id':        `SHP${o.orderNo.slice(-4)}`,
      'transaction-type':   status,
      'amount-type':        'Net Settlement',
      'amount-description': 'Net Settlement',
      'amount':             o.settlementNet,
      'posted-date':        o.date,
    });
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(settlementRows);
  XLSX.utils.book_append_sheet(wb, ws, 'Settlement');
  writeFileSync(join(outDir, 'amazon-settlement-sample.xlsx'),
    XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

  // Amazon seller sales register
  const registerRows = [];
  for (const o of orders) {
    registerRows.push({
      'Order ID':                 o.orderNo,
      'Order Date':               o.date,
      'SKU':                      o.p.sku,
      'Product Name':             o.p.name,
      'Sale Amount':              o.p.price,
      'Expected Settlement Amount': o.baseNet,
      'Order Status':             o.isReturn ? 'Returned' : 'Delivered',
    });
  }
  // duplicate
  const dupSrc = registerRows.find(r => r['Order ID'] === orders[9].orderNo);
  registerRows.splice(registerRows.indexOf(dupSrc) + 1, 0, { ...dupSrc });

  const csvText = Papa.unparse(registerRows);
  writeFileSync(join(outDir, 'amazon-seller-register-sample.csv'), csvText + '\n');

  console.log(`Amazon: ${settlementRows.length} settlement rows, ${registerRows.length} register rows`);
}

// ── Flipkart ───────────────────────────────────────────────────────────────────
function writeFlipkartSamples(orders, scenarios) {
  const { missingFromSettlement, settlementOnly } = scenarios;

  const settlementRows = [];
  for (const o of [...orders, ...settlementOnly]) {
    if (missingFromSettlement.has(o.orderNo)) continue;
    settlementRows.push({
      'Order ID':               o.orderNo,
      'Order Item ID':          `FKITEM${o.orderNo.slice(-5)}`,
      'Order Date':             o.date,
      'SKU':                    o.p.sku,
      'Product Name':           o.p.name,
      'Total Offer Price':      o.p.price,
      'Commission':             o.commission,
      'Fixed Closing Fee':      round2(11),
      'Collection Fee':         round2(o.p.price * 0.015),
      'Logistics Fee':          o.isReturn ? 0 : o.shipping,
      'Reverse Pickup Charges': o.isReturn ? 68 : 0,
      'IGST TCS':               o.tcs / 2,
      'CGST TCS':               o.tcs / 2,
      'TDS':                    0,
      'Final Settlement Amount': o.settlementNet,
      'Order Status':           o.isReturn ? 'RTO' : 'Delivered',
      'Settlement Status':      'Settled',
    });
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(settlementRows);
  XLSX.utils.book_append_sheet(wb, ws, 'Settlement');
  writeFileSync(join(outDir, 'flipkart-settlement-sample.xlsx'),
    XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

  const registerRows = [];
  for (const o of orders) {
    registerRows.push({
      'Order ID':                 o.orderNo,
      'Order Date':               o.date,
      'SKU':                      o.p.sku,
      'Product Name':             o.p.name,
      'Sale Amount':             o.p.price,
      'Expected Settlement Amount': o.baseNet,
      'Order Status':             o.isReturn ? 'Returned' : 'Delivered',
    });
  }
  const dupSrc = registerRows.find(r => r['Order ID'] === orders[9].orderNo);
  registerRows.splice(registerRows.indexOf(dupSrc) + 1, 0, { ...dupSrc });

  const csvText = Papa.unparse(registerRows);
  writeFileSync(join(outDir, 'flipkart-seller-register-sample.csv'), csvText + '\n');

  console.log(`Flipkart: ${settlementRows.length} settlement rows, ${registerRows.length} register rows`);
}

// ── Meesho ────────────────────────────────────────────────────────────────────
function writeMeeshoSamples(orders, scenarios) {
  const { missingFromSettlement, settlementOnly } = scenarios;

  const settlementRows = [];
  for (const o of [...orders, ...settlementOnly]) {
    if (missingFromSettlement.has(o.orderNo)) continue;
    settlementRows.push({
      'Sub Order No':                          o.orderNo,
      'Transaction ID':                        `TXN${o.orderNo.slice(-5)}JUL26`,
      'Transaction Date':                      o.date,
      'SKU':                                   o.p.sku,
      'Product Name':                          o.p.name,
      'Supplier Listed Price':                 o.p.price,
      'Commission (Including GST)':            o.commission,
      'Forward Shipping Charges':              o.isReturn ? 0 : o.shipping,
      'Return Shipping Charge (If Applicable)': o.isReturn ? 68 : 0,
      'TCS Amount':                            o.tcs,
      'Final Settlement Amount':               o.settlementNet,
      'Live Order Status':                     o.isReturn ? 'RTO' : (o.orderNo.endsWith('013') ? 'Return' : 'Delivered'),
      'Settlement Status':                     'Done',
    });
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(settlementRows);
  XLSX.utils.book_append_sheet(wb, ws, 'Payment File');
  writeFileSync(join(outDir, 'meesho-settlement-sample.xlsx'),
    XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

  const registerRows = [];
  for (const o of orders) {
    registerRows.push({
      'Order ID':                 o.orderNo,
      'Order Date':               o.date,
      'SKU':                      o.p.sku,
      'Product Name':             o.p.name,
      'Sale Amount':              o.p.price,
      'Expected Settlement Amount': o.baseNet,
      'Order Status':             o.isReturn ? 'Returned' : 'Delivered',
    });
  }
  const dupSrc = registerRows.find(r => r['Order ID'] === orders[9].orderNo);
  registerRows.splice(registerRows.indexOf(dupSrc) + 1, 0, { ...dupSrc });

  const csvText = Papa.unparse(registerRows);
  writeFileSync(join(outDir, 'meesho-seller-register-sample.csv'), csvText + '\n');

  console.log(`Meesho: ${settlementRows.length} settlement rows, ${registerRows.length} register rows`);
}

// ── Main ───────────────────────────────────────────────────────────────────────
function buildScenarios(orders) {
  // 3 amount mismatches
  const mismatchIds = new Set([orders[4].orderNo, orders[11].orderNo, orders[18].orderNo]);
  // 2 missing from settlement
  const missingFromSettlement = new Set([orders[6].orderNo, orders[16].orderNo]);
  // 2 extra settlements (no register entry)
  const settlementOnly = [orders[0], orders[7]].map(o => ({
    ...o,
    orderNo: o.orderNo + 'X',
    settlementNet: round2(o.net * 0.5),
    baseNet: round2(o.net * 0.5),
  }));
  const { list } = applyScenarios(orders, mismatchIds, missingFromSettlement, settlementOnly);
  return { list, mismatchIds, missingFromSettlement, settlementOnly };
}

const TOTAL = 23;
const amazonScenarios   = buildScenarios(generateOrders('AMZ', TOTAL));
const flipkartScenarios = buildScenarios(generateOrders('FK',  TOTAL));
const meeshoScenarios   = buildScenarios(generateOrders('MH',  TOTAL));

writeAmazonSamples(amazonScenarios.list,   amazonScenarios);
writeFlipkartSamples(flipkartScenarios.list, flipkartScenarios);
writeMeeshoSamples(meeshoScenarios.list,  meeshoScenarios);

console.log('\nExpected per marketplace:');
console.log('  15 MATCHED  | 3 AMOUNT_MISMATCH | 2 MISSING_SETTLEMENT');
console.log('   2 UNMATCHED_MARKETPLACE_RECORD | 1 DUPLICATE_RECORD | 2 RETURN_DISCREPANCY');
console.log('\nFiles written to sample-data/');
