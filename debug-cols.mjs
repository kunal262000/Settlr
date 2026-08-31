import * as XLSX from '@e965/xlsx';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const buf = readFileSync(join('sample-data', 'amazon-settlement-sample.xlsx'));
const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: false });
const cols = Object.keys(rows[0]);
console.log('Amazon settlement columns:', cols);
console.log('Normalized:');
const normalizeHeader = (h) => h.toLowerCase().replace(/[_\-]/g, ' ').replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
for (const c of cols) console.log(' ', JSON.stringify(normalizeHeader(c)));
