#!/usr/bin/env node
// Keeps GitHub Issues on the review repo in step with docs/data/findings.json.
// Uses the `gh` CLI (already logged in) so no token handling is needed here.
//
//   node scripts/sync-issues.mjs            create missing issues, pull open/closed state, close fixed ones
//   node scripts/sync-issues.mjs --dry-run  show what would change
//
// One issue per finding, titled "[A1] …", labelled finding + severity:x + category:y (the id is in the title).
// Rules:
//   issue closed on GitHub            → finding status "closed" (unless the scanner already marked it "fixed")
//   issue reopened on GitHub          → finding status "open"
//   finding "fixed" by the scanner    → issue closed with a comment
//   new issue labelled "finding" with no id label → imported as the next S-number
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadFindings, saveFindings, nextScanId, setStatus, SEVERITIES, CATEGORIES } from './lib/data.mjs';

const dry = process.argv.includes('--dry-run');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'config.json'), 'utf8'));
const repo = process.env.REVIEW_REPO || config.reviewRepo || detectRepo();
if (!repo) throw new Error('Set reviewRepo in docs/config.json (owner/name) or REVIEW_REPO.');

function gh(args, input) {
  const r = spawnSync('gh', args, { encoding: 'utf8', input, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`gh ${args.slice(0, 3).join(' ')}: ${r.stderr.trim()}`);
  return r.stdout;
}
function detectRepo() {
  const r = spawnSync('git', ['-C', ROOT, 'remote', 'get-url', 'origin'], { encoding: 'utf8' });
  const m = (r.stdout || '').match(/github\.com[:/]([^/]+\/[^/.\s]+)/);
  return m ? m[1] : null;
}

const LABELS = {
  finding: ['6f42c1', 'A finding from the code review dashboard'],
  'severity:critical': ['b60205', ''], 'severity:high': ['d93f0b', ''], 'severity:medium': ['fbca04', ''], 'severity:low': ['c5def5', ''],
};
function ensureLabels(extra) {
  const existing = new Set(JSON.parse(gh(['label', 'list', '-R', repo, '--limit', '500', '--json', 'name'])).map((l) => l.name));
  const wanted = { ...LABELS };
  for (const n of extra) if (!wanted[n]) wanted[n] = [n.startsWith('category:') ? '0e8a16' : 'ededed', ''];
  for (const [name, [color, desc]] of Object.entries(wanted)) {
    if (existing.has(name)) continue;
    console.log(`label  + ${name}`);
    if (!dry) gh(['label', 'create', name, '-R', repo, '--color', color, '--description', desc]);
  }
}

const data = loadFindings();
const findings = data.findings;
const appRepo = config.appRepo;
const pagesUrl = config.pagesUrl || `https://${repo.split('/')[0]}.github.io/${repo.split('/')[1]}/`;

function fileUrl(f) { return f.file ? `https://github.com/${appRepo}/blob/${f.commit || data.reviewedCommit}/${f.file}${f.line ? `#L${f.line}` : ''}` : null; }
function body(f) {
  const loc = fileUrl(f) ? `**Where:** [${f.file}${f.line ? ':' + f.line : ''}](${fileUrl(f)})${f.verifiers ? `  ·  **Verifiers upholding:** ${f.verifiers}` : ''}\n\n` : '';
  return `${loc}**What:** ${f.what}\n\n${f.evidence ? `**Evidence:** ${f.evidence}\n\n` : ''}${f.goesWrong ? `**What goes wrong:** ${f.goesWrong}\n\n` : ''}${f.fix ? `**Suggested fix:** ${f.fix}\n\n` : ''}---\nDashboard: ${pagesUrl}#/f/${f.id}  ·  Source: ${f.source}`;
}

// 1. fetch all finding issues
const issues = JSON.parse(gh(['issue', 'list', '-R', repo, '--label', 'finding', '--state', 'all', '--limit', '1000', '--json', 'number,title,state,labels,body,url']));
const byId = new Map();
const unlabelled = [];
for (const i of issues) {
  const idLabel = i.labels.map((l) => l.name).find((n) => n.startsWith('id:'));
  const id = idLabel ? idLabel.slice(3) : (i.title.match(/^\[([ALS]\d+)\]/) || [])[1];
  if (id) byId.set(id, i); else unlabelled.push(i);
}
console.log(`${issues.length} finding issues on ${repo}, ${findings.length} findings in data`);

ensureLabels([...new Set(findings.map((f) => `category:${f.category}`))]);

let created = 0, closedOnGh = 0, reopened = 0, closedFixed = 0, imported = 0;

// 2. pull state from GitHub, create what is missing, close what the scanner fixed
for (const f of findings) {
  const issue = byId.get(f.id);
  if (!issue) {
    console.log(`create ${f.id} ${f.title.slice(0, 70)}`);
    created++;
    if (!dry) {
      const url = gh(['issue', 'create', '-R', repo, '--title', `[${f.id}] ${f.title}`, '--body', body(f), '--label', `finding,severity:${f.severity},category:${f.category}`]).trim();
      f.issue = Number(url.split('/').pop());
      if (f.status !== 'open') { gh(['issue', 'close', '-R', repo, String(f.issue), '--comment', `Status in the review data: ${f.status}.`]); }
    }
    continue;
  }
  f.issue = issue.number;
  if (f.status === 'fixed' && issue.state === 'OPEN') {
    console.log(`close  ${f.id} (fixed by scanner)`); closedFixed++;
    if (!dry) gh(['issue', 'close', '-R', repo, String(issue.number), '--reason', 'completed', '--comment', `The quality scanner found this fixed: ${(f.history || []).slice(-1)[0]?.note || ''}`]);
  } else if (f.status === 'open' && issue.state === 'CLOSED') {
    console.log(`closed ${f.id} (closed on GitHub)`); closedOnGh++;
    if (!dry) setStatus(f, 'closed', `Closed on GitHub (#${issue.number})`);
  } else if (f.status === 'closed' && issue.state === 'OPEN') {
    console.log(`reopen ${f.id} (reopened on GitHub)`); reopened++;
    if (!dry) setStatus(f, 'open', `Reopened on GitHub (#${issue.number})`);
  }
}

// 3. import issues people opened by hand
for (const i of unlabelled) {
  const sev = (i.labels.map((l) => l.name).find((n) => n.startsWith('severity:')) || 'severity:medium').slice(9);
  const cat = (i.labels.map((l) => l.name).find((n) => n.startsWith('category:')) || 'category:bug').slice(9);
  const field = (name) => (i.body.match(new RegExp(`\\*\\*${name}:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\*\\*[A-Za-z ]+:\\*\\*|\\n---|$)`)) || [])[1]?.trim() || '';
  const whereM = field('Where').match(/\[([^\]]+?)(?::(\d+))?\]/);
  const id = nextScanId(findings);
  const title = i.title.replace(/^\[[A-Z]\d+\]\s*/, '');
  console.log(`import #${i.number} as ${id}: ${title.slice(0, 60)}`);
  imported++;
  if (dry) continue;
  findings.push({ id, title, severity: SEVERITIES.includes(sev) ? sev : 'medium', category: CATEGORIES.includes(cat) ? cat : 'bug', file: whereM ? whereM[1] : null, line: whereM && whereM[2] ? Number(whereM[2]) : null, verifiers: null, what: field('What') || i.body.slice(0, 2000), evidence: field('Evidence'), goesWrong: field('What goes wrong'), fix: field('Suggested fix'), source: 'github-issue', commit: data.scannedCommit || data.reviewedCommit, status: i.state === 'CLOSED' ? 'closed' : 'open', issue: i.number, history: [{ at: new Date().toISOString(), status: i.state === 'CLOSED' ? 'closed' : 'open', note: `Imported from issue #${i.number}` }] });
  gh(['issue', 'edit', '-R', repo, String(i.number), '--title', `[${id}] ${title}`]);
}

if (!dry) saveFindings(data);
console.log(`\n${dry ? 'Would: ' : ''}created ${created}, closed-on-github ${closedOnGh}, reopened ${reopened}, closed-as-fixed ${closedFixed}, imported ${imported}.${dry ? '' : ' Data saved; commit and push docs/data/findings.json.'}`);
