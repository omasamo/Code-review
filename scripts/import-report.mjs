#!/usr/bin/env node
// One-off (but re-runnable) importer: turns the markdown review reports into
// docs/data/findings.json and docs/data/overview.json.
//
// Re-running it keeps the status/history/issue fields of findings that already
// exist in findings.json, so it is safe to run again after fixing the parser.
//
//   node scripts/import-report.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, DATA_DIR, loadFindings, saveFindings, saveOverview, nowIso } from './lib/data.mjs';

const REPORTS = path.join(ROOT, 'reports');
const evidence = fs.readFileSync(path.join(REPORTS, 'tinnitus-app-review-v2-evidence.md'), 'utf8');
const complete = fs.readFileSync(path.join(REPORTS, 'tinnitus-app-complete-review.md'), 'utf8');
const council = fs.readFileSync(path.join(REPORTS, 'tinnitus-app-review-v3-council.md'), 'utf8');

const REVIEW_SOURCE = 'review-2026-10-05';
const REVIEW_COMMIT = '5513c30';

// ---------------------------------------------------------------- evidence (A1..A178)
function parseEvidence(md) {
  const out = [];
  const re = /^## (A\d+)\. \[([A-Z]+) · ([a-z0-9-]+)\] (.+)$/gm;
  const heads = [...md.matchAll(re)];
  heads.forEach((h, i) => {
    const start = h.index + h[0].length;
    const end = i + 1 < heads.length ? heads[i + 1].index : md.length;
    const body = md.slice(start, end);
    const field = (name) => {
      const m = body.match(new RegExp(`\\*\\*${name}:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\*\\*[A-Za-z ]+:\\*\\*|\\n## |$)`));
      return m ? m[1].trim() : '';
    };
    const whereRaw = field('Where');
    const whereM = whereRaw.match(/`([^`]+)`/);
    const verifiersM = whereRaw.match(/Verifiers upholding:\*\*\s*(\d\/\d)/);
    const loc = parseLocation(whereM ? whereM[1] : '');
    out.push({
      id: h[1],
      title: h[4].trim(),
      severity: h[2].toLowerCase(),
      category: h[3],
      file: loc.file,
      line: loc.line,
      verifiers: verifiersM ? verifiersM[1] : null,
      what: field('What'),
      evidence: field('Evidence'),
      goesWrong: field('What goes wrong'),
      fix: field('Suggested fix'),
    });
  });
  return out;
}

function parseLocation(s) {
  const m = s.match(/^([^:]+?)(?::(\d+))?(?:[-–]\d+)?$/);
  if (!m) return { file: s || null, line: null };
  return { file: m[1], line: m[2] ? Number(m[2]) : null };
}

// ---------------------------------------------------------------- legal (L1..L17)
function parseLegal(md) {
  const start = md.indexOf('# Part 3. Legal and privacy review (v1)');
  const end = md.indexOf('# Part 4.', start);
  const part = md.slice(start, end);
  const out = [];
  const sevOf = (heading) => heading.toLowerCase();
  // Critical / High / Medium: "#### N. Title" followed by paragraphs.
  const sections = part.split(/^### /m).slice(1);
  for (const sec of sections) {
    const nl = sec.indexOf('\n');
    const heading = sec.slice(0, nl).trim();
    const body = sec.slice(nl + 1);
    if (!['Critical', 'High', 'Medium', 'Low'].includes(heading)) continue;
    const severity = sevOf(heading);
    if (heading === 'Low') {
      for (const m of body.matchAll(/^(\d+)\. \*\*(.+?)\*\*:?\s*([\s\S]*?)(?=^\d+\. \*\*|\n---|$)/gm)) {
        out.push(mkLegal(m[1], m[2], m[3].trim(), severity));
      }
      continue;
    }
    const items = body.split(/^#### /m).slice(1);
    for (const it of items) {
      const m = it.match(/^(\d+)\. (.+)\n([\s\S]*)$/);
      if (!m) continue;
      out.push(mkLegal(m[1], m[2].trim(), m[3].trim().replace(/\n---\s*$/, ''), severity));
    }
  }
  return out;
}

function mkLegal(n, title, text, severity) {
  const fileM = text.match(/`((?:app|src|docs|tests)\/[^`:\s]+|app\.json|eas\.json|firebase\.json|package\.json|en\.json)(?::(\d+))?/);
  return {
    id: `L${n}`,
    title: title.replace(/[.:]$/, ''),
    severity,
    category: 'legal',
    file: fileM ? (fileM[1] === 'en.json' ? 'app/i18n/locales/en.json' : fileM[1]) : null,
    line: fileM && fileM[2] ? Number(fileM[2]) : null,
    verifiers: null,
    what: text,
    evidence: '',
    goesWrong: '',
    fix: '',
  };
}

// ---------------------------------------------------------------- overview (council verdict)
function parseCouncil(md) {
  const section = (title) => {
    const m = md.match(new RegExp(`^## \\d+\\. ${title}\\n([\\s\\S]*?)(?=^## \\d+\\. |(?![\\s\\S]))`, 'm'));
    return m ? m[1].trim() : '';
  };
  const verdict = section('Verdict');
  const top10Md = section('Final top 10');
  const plan = section('Plan');
  const changed = section('What changed from v2');
  const disagreed = section('Where the council disagreed, and the chair\'s call');

  // Top 10: numbered items, each "N. **Title.** body" possibly with sub-bullets.
  const top10 = [];
  for (const m of top10Md.matchAll(/^(\d+)\. \*\*(.+?)\*\*\s*([\s\S]*?)(?=^\d+\. \*\*|(?![\s\S]))/gm)) {
    const body = m[3].trim();
    const refs = [...body.matchAll(/\b([AL]\d+)\b/g)].map((x) => x[1]);
    const seats = (body.match(/\*Top 5 for: ([^*]+)\.\*/) || [])[1] || '';
    top10.push({
      rank: Number(m[1]),
      title: m[2].replace(/\.$/, ''),
      body: body.replace(/\s*\*Top 5 for:[^*]+\*\s*$/, '').trim(),
      refs: [...new Set(refs)],
      seats: seats.split(',').map((s) => s.trim()).filter(Boolean),
    });
  }
  return { verdict, top10, plan, changed, disagreed };
}

// ---------------------------------------------------------------- run
const existing = loadFindings();
const byId = new Map(existing.findings.map((f) => [f.id, f]));
const parsed = [...parseEvidence(evidence), ...parseLegal(complete)];
const ts = nowIso();
const merged = parsed.map((p) => {
  const prev = byId.get(p.id);
  return {
    ...p,
    source: prev?.source ?? REVIEW_SOURCE,
    commit: prev?.commit ?? REVIEW_COMMIT,
    status: prev?.status ?? 'open',
    issue: prev?.issue ?? null,
    history: prev?.history ?? [{ at: ts, status: 'open', note: `Imported from ${REVIEW_SOURCE}` }],
  };
});
// Keep findings that are not in the reports (added later by the scanner).
const parsedIds = new Set(merged.map((f) => f.id));
for (const f of existing.findings) if (!parsedIds.has(f.id)) merged.push(f);

saveFindings({ ...existing, reviewedCommit: existing.reviewedCommit ?? REVIEW_COMMIT, findings: merged });
saveOverview({ ...parseCouncil(council), generatedAt: ts, reviewedCommit: REVIEW_COMMIT, appRepo: 'kamil12345/tinnitus-app' });

const counts = {};
for (const f of merged) counts[f.severity] = (counts[f.severity] || 0) + 1;
console.log(`Wrote ${merged.length} findings to ${path.relative(ROOT, DATA_DIR)}/findings.json`, counts);
