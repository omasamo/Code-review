// Shared helpers for reading and writing the dashboard's data files.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATA_DIR = path.join(ROOT, 'docs', 'data');
export const FINDINGS_PATH = path.join(DATA_DIR, 'findings.json');
export const OVERVIEW_PATH = path.join(DATA_DIR, 'overview.json');

export const SEVERITIES = ['critical', 'high', 'medium', 'low'];
export const STATUSES = ['open', 'fixed', 'closed'];
export const CATEGORIES = [
  'bug', 'architecture', 'code-quality', 'design-decision', 'i18n', 'ux',
  'performance', 'security', 'testing', 'legal',
];

export function nowIso() {
  return new Date().toISOString();
}

export function loadFindings() {
  if (!fs.existsSync(FINDINGS_PATH)) return { version: 1, reviewedCommit: null, scannedCommit: null, findings: [] };
  return JSON.parse(fs.readFileSync(FINDINGS_PATH, 'utf8'));
}

export function saveFindings(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  data.findings.sort(compareFindings);
  data.updatedAt = nowIso();
  fs.writeFileSync(FINDINGS_PATH, JSON.stringify(data, null, 2) + '\n');
}

export function saveOverview(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(OVERVIEW_PATH, JSON.stringify(data, null, 2) + '\n');
}

// A1..A178 first (numeric), then L1..L17, then scanner findings S1.. in order.
const PREFIX_ORDER = { A: 0, L: 1, S: 2 };
export function compareFindings(a, b) {
  const pa = PREFIX_ORDER[a.id[0]] ?? 9, pb = PREFIX_ORDER[b.id[0]] ?? 9;
  if (pa !== pb) return pa - pb;
  return Number(a.id.slice(1)) - Number(b.id.slice(1));
}

export function nextScanId(findings) {
  let max = 0;
  for (const f of findings) if (f.id[0] === 'S') max = Math.max(max, Number(f.id.slice(1)));
  return `S${max + 1}`;
}

export function setStatus(finding, status, note, extra = {}) {
  if (!STATUSES.includes(status)) throw new Error(`bad status ${status}`);
  finding.status = status;
  finding.history = finding.history || [];
  finding.history.push({ at: nowIso(), status, note, ...extra });
}
