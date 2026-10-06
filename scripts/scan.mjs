#!/usr/bin/env node
// Quality scanner for the Tinnitus Tracker app.
//
//   node scripts/scan.mjs scan [--repo ../tinnitus-app] [--base <ref>] [--head <ref>] [--backend api|cli|prompt] [--dry-run]
//   node scripts/scan.mjs ingest <result.json> --head <sha>      apply a review produced from a prompt file
//   node scripts/scan.mjs set-status <id> <open|fixed|closed> [note]
//   node scripts/scan.mjs add --title "..." --severity high --category bug --file app/x.ts:12 --what "..." [--fix "..."] [--wrong "..."]
//   node scripts/scan.mjs check [--repo ..] [--head <ref>]       cheap, no Claude: flags open findings whose file is gone
//
// The scan reviews everything changed between the last scanned commit (or the
// reviewed commit) and HEAD, looks for the same classes of issue as the original
// review, marks existing findings fixed when their code is gone, and adds new
// findings. It never modifies the app repository.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadFindings, saveFindings, nextScanId, setStatus, nowIso, SEVERITIES, CATEGORIES } from './lib/data.mjs';
import { resolveRepo, revParse, changedFiles, diff, show, exists, log } from './lib/git.mjs';
import { detectBackend, review, DEFAULT_MODEL } from './lib/claude.mjs';

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
const SCRATCH = path.join(ROOT, '.scan');

const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '.md', '.xml', '.gradle', '.plist', '.sh']);
const IGNORE = [/^node_modules\//, /^android\/build\//, /^ios\/Pods\//, /\.lock$/, /^package-lock\.json$/, /\.(png|jpg|jpeg|webp|svg|ttf|otf)$/i];
const MAX_FILE_CHARS = 60_000;
const MAX_TOTAL_CHARS = 600_000;

try {
  if (cmd === 'scan') await scan();
  else if (cmd === 'ingest') await ingest();
  else if (cmd === 'set-status') setStatusCmd();
  else if (cmd === 'add') addCmd();
  else if (cmd === 'check') check();
  else { console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n')); process.exit(cmd ? 1 : 0); }
} catch (e) {
  console.error(`error: ${e.message}`);
  process.exit(1);
}

// ------------------------------------------------------------------ scan
async function scan() {
  const repo = resolveRepo(args.repo);
  const data = loadFindings();
  const base = revParse(repo, args.base || data.scannedCommit || data.reviewedCommit || 'main');
  const head = revParse(repo, args.head || 'HEAD');
  const backend = args.backend || detectBackend();
  console.log(`repo    ${repo}\nbase    ${base.slice(0, 7)}\nhead    ${head.slice(0, 7)}\nbackend ${backend}${backend !== 'prompt' ? ` (${args.model || DEFAULT_MODEL})` : ''}`);
  if (base === head) { console.log('Nothing new since the last scan.'); return; }

  const changes = changedFiles(repo, base, head).filter((c) => !IGNORE.some((re) => re.test(c.file)) && CODE_EXT.has(path.extname(c.file)));
  if (!changes.length) { console.log('No code changes in that range.'); finish(data, head, { resolved: [], new: [] }, 'no code changes'); return; }
  console.log(`${changes.length} changed files, ${log(repo, base, head).split('\n').length} commits`);

  const changedSet = new Set(changes.map((c) => c.file));
  const openTouching = data.findings.filter((f) => f.status === 'open' && f.file && (changedSet.has(f.file) || changes.some((c) => c.from === f.file)));
  const deleted = openTouching.filter((f) => !exists(repo, head, f.file));

  const prompt = buildPrompt({ repo, base, head, changes, openTouching, deleted, data });
  if (args['dry-run']) { fs.mkdirSync(SCRATCH, { recursive: true }); fs.writeFileSync(path.join(SCRATCH, 'last-prompt.md'), prompt.system + '\n\n' + prompt.user); console.log(`Dry run. Prompt written to .scan/last-prompt.md (${(prompt.user.length / 1000).toFixed(0)}k chars).`); return; }

  fs.mkdirSync(SCRATCH, { recursive: true });
  const promptFile = path.join(SCRATCH, `prompt-${head.slice(0, 7)}.md`);
  const result = await review({ backend, system: prompt.system, prompt: prompt.user, model: args.model, promptFile });
  if (!result) {
    console.log(`\nPrompt written to ${path.relative(process.cwd(), promptFile)}.\nHave Claude answer it (for example paste it into a Claude Code session with access to the app repo), save the JSON answer, then run:\n  node scripts/scan.mjs ingest <answer.json> --head ${head}`);
    return;
  }
  finish(data, head, result, `scan of ${base.slice(0, 7)}..${head.slice(0, 7)}`);
}

async function ingest() {
  const file = args._[1];
  if (!file || !args.head) throw new Error('usage: ingest <result.json> --head <sha>');
  const repo = resolveRepo(args.repo);
  const head = revParse(repo, args.head);
  const { parseResult } = await import('./lib/claude.mjs');
  const result = parseResult(fs.readFileSync(file, 'utf8'));
  finish(loadFindings(), head, result, `scan ingested from ${path.basename(file)}`);
}

function finish(data, head, result, note) {
  const ts = nowIso();
  const byId = new Map(data.findings.map((f) => [f.id, f]));
  let fixed = 0, added = 0;
  for (const r of result.resolved || []) {
    const f = byId.get(r.id);
    if (!f || f.status !== 'open') continue;
    setStatus(f, 'fixed', r.reason || 'Code gone', { commit: head });
    fixed++;
  }
  for (const n of result.new || []) {
    if (!n.title || !SEVERITIES.includes(n.severity) || !CATEGORIES.includes(n.category)) continue;
    const dup = data.findings.find((f) => f.status === 'open' && f.file === n.file && f.title.toLowerCase() === n.title.toLowerCase());
    if (dup) continue;
    const id = nextScanId(data.findings);
    data.findings.push({
      id, title: n.title, severity: n.severity, category: n.category, file: n.file || null, line: n.line ?? null,
      verifiers: null, what: n.what || '', evidence: n.evidence || '', goesWrong: n.goesWrong || '', fix: n.fix || '',
      source: `scan-${ts.slice(0, 10)}`, commit: head.slice(0, 7), status: 'open', issue: null,
      history: [{ at: ts, status: 'open', note: `Found by quality scan at ${head.slice(0, 7)}`, commit: head }],
    });
    added++;
  }
  data.scannedCommit = head;
  data.scans = data.scans || [];
  data.scans.push({ at: ts, head, fixed, added, note, notes: (result.notes || '').slice(0, 2000) });
  saveFindings(data);
  console.log(`\nMarked ${fixed} finding(s) fixed, added ${added} new. scannedCommit = ${head.slice(0, 7)}.`);
  if (result.notes) console.log(`Reviewer notes: ${result.notes.slice(0, 1500)}`);
  console.log('Commit docs/data/findings.json and push to update the dashboard.');
}

function buildPrompt({ repo, base, head, changes, openTouching, deleted, data }) {
  const system = `You are a meticulous senior React Native / Expo reviewer continuing an existing code review of a tinnitus diary app (Expo SDK 55, expo-router, SQLite, i18next, Firebase, RevenueCat). The original review verified ${data.findings.length} findings; each had to survive three independent checkers. Keep that bar: report only what you can point to in the code you are given, with file and line. Do not speculate about code you cannot see.

Issue classes the review tracks (use these as "category"):
- bug: wrong behaviour, crashes, data loss, timezone/date errors, race conditions, missing validation, unhandled promises
- architecture: duplication that has already drifted, god components, missing data layer, dead subsystems, boundary violations
- code-quality: copy-paste, boilerplate, stale comments/docs, hygiene
- design-decision: works as written but deserves a deliberate choice (UX flow, model assumptions, inconsistent controls)
- i18n: hard-coded English, missing keys, locale/date mismatches, plural rules
- ux: accessibility labels, contrast, tap targets, confusing states
- performance: per-render allocations, repeated formatting, unbounded queries
- security: secrets, backups of sensitive data, permissions, unsafe links
- testing: tests that cannot run, untested risky logic, CI gaps
- legal: privacy policy / consent / store policy / health-claim issues

Severity: critical = data loss, crash, or wrong health data; high = user-visible bug or serious structural debt; medium = real but contained; low = polish.

Health data rule: this is a wellness diary. Flag anything that sends symptom values (intensity, pitch, notes, triggers) to analytics or logs, and anything that turns the app into a measurement or diagnosis tool.`;

  let user = `# Scan request\n\nApp repository: ${data.appRepo || 'kamil12345/tinnitus-app'}\nRange: ${base}..${head}\n\nCommits in range:\n${log(repo, base, head)}\n\n`;

  if (openTouching.length) {
    user += `# Open findings that touch the changed files\n\nFor each, decide whether the change RESOLVES it (the problematic code is gone or corrected). Only list it under "resolved" if you are confident from the code shown; a partial fix stays open. Deleted files: ${deleted.map((f) => f.id).join(', ') || 'none'}.\n\n`;
    for (const f of openTouching) {
      user += `## ${f.id} [${f.severity} · ${f.category}] ${f.title}\nWhere: ${f.file}${f.line ? ':' + f.line : ''}\nWhat: ${f.what}\n${f.evidence ? `Evidence: ${f.evidence}\n` : ''}${f.fix ? `Suggested fix: ${f.fix}\n` : ''}\n`;
    }
  }

  user += `# Diff (${base.slice(0, 7)}..${head.slice(0, 7)})\n\n\`\`\`diff\n${truncate(diff(repo, base, head, changes.map((c) => c.file)), MAX_TOTAL_CHARS / 2)}\n\`\`\`\n\n`;

  user += `# Full content of changed files at ${head.slice(0, 7)}\n\n`;
  let budget = MAX_TOTAL_CHARS / 2;
  for (const c of changes) {
    if (c.status === 'D') { user += `## ${c.file}\n(deleted)\n\n`; continue; }
    const content = show(repo, head, c.file);
    const piece = truncate(content, Math.min(MAX_FILE_CHARS, budget));
    budget -= piece.length;
    user += `## ${c.file}\n\`\`\`\n${withLineNumbers(piece)}\n\`\`\`\n\n`;
    if (budget <= 0) { user += `(remaining files omitted for size; scan a smaller range for full coverage)\n`; break; }
  }

  user += `# Task\n\n1. "resolved": ids of the open findings above that this change fully resolves, each with a one-sentence reason citing the new code.\n2. "new": new findings introduced or exposed by the changed code, in the review's own format (title, severity, category, file, line, what, evidence with file:line and quoted code, what goes wrong for the user, suggested fix). Do not repeat findings already listed above or minor style nits. Line numbers refer to the numbered file contents.\n3. "notes": one short paragraph on the overall quality of this change set.\n\nAnswer as JSON matching the schema.`;
  return { system, user };
}

function withLineNumbers(s) { return s.split('\n').map((l, i) => `${String(i + 1).padStart(4)}  ${l}`).join('\n'); }
function truncate(s, n) { return s.length > n ? s.slice(0, n) + `\n… (truncated ${s.length - n} chars)` : s; }

// ------------------------------------------------------------------ manual commands
function setStatusCmd() {
  const [, id, status, ...noteParts] = args._;
  if (!id || !status) throw new Error('usage: set-status <id> <open|fixed|closed> [note]');
  const data = loadFindings();
  const f = data.findings.find((x) => x.id === id);
  if (!f) throw new Error(`no finding ${id}`);
  setStatus(f, status, noteParts.join(' ') || 'Set by hand');
  saveFindings(data);
  console.log(`${id} → ${status}`);
}

function addCmd() {
  for (const k of ['title', 'severity', 'category', 'what']) if (!args[k]) throw new Error(`add needs --${k}`);
  if (!SEVERITIES.includes(args.severity)) throw new Error(`severity must be one of ${SEVERITIES.join(', ')}`);
  if (!CATEGORIES.includes(args.category)) throw new Error(`category must be one of ${CATEGORIES.join(', ')}`);
  const data = loadFindings();
  const [file, line] = String(args.file || '').split(':');
  const id = nextScanId(data.findings);
  const ts = nowIso();
  data.findings.push({ id, title: args.title, severity: args.severity, category: args.category, file: file || null, line: line ? Number(line) : null, verifiers: null, what: args.what, evidence: args.evidence || '', goesWrong: args.wrong || '', fix: args.fix || '', source: `manual-${ts.slice(0, 10)}`, commit: data.scannedCommit || data.reviewedCommit, status: 'open', issue: null, history: [{ at: ts, status: 'open', note: 'Added by hand' }] });
  saveFindings(data);
  console.log(`added ${id}`);
}

function check() {
  const repo = resolveRepo(args.repo);
  const data = loadFindings();
  const head = revParse(repo, args.head || 'HEAD');
  let gone = 0;
  for (const f of data.findings) {
    if (f.status !== 'open' || !f.file) continue;
    if (!exists(repo, head, f.file)) { gone++; console.log(`${f.id}\t${f.file} no longer exists at ${head.slice(0, 7)}\t${f.title}`); }
  }
  console.log(gone ? `\n${gone} open finding(s) point at files that no longer exist. Run a scan to let Claude decide whether they are fixed.` : 'All open findings still point at existing files.');
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); const v = argv[i + 1]; if (v !== undefined && !v.startsWith('--')) { out[k] = v; i++; } else out[k] = true; }
    else out._.push(a);
  }
  return out;
}
