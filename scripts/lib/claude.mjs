// Three ways to get a review out of Claude:
//   api    - Anthropic SDK, needs ANTHROPIC_API_KEY (or an `ant auth login` profile)
//   cli    - the Claude Code CLI (`claude -p`), uses its own login; set CLAUDE_BIN if not on PATH
//   prompt - write the prompt to a file so a Claude Code session can answer it and `scan.mjs ingest` the JSON
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

export const DEFAULT_MODEL = process.env.SCAN_MODEL || 'claude-opus-5-5';

export const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['resolved', 'new', 'notes'],
  properties: {
    resolved: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['id', 'reason'],
        properties: { id: { type: 'string' }, reason: { type: 'string' } },
      },
    },
    new: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'severity', 'category', 'file', 'line', 'what', 'evidence', 'goesWrong', 'fix'],
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          category: { type: 'string', enum: ['bug', 'architecture', 'code-quality', 'design-decision', 'i18n', 'ux', 'performance', 'security', 'testing', 'legal'] },
          file: { type: 'string' },
          line: { type: ['integer', 'null'] },
          what: { type: 'string' },
          evidence: { type: 'string' },
          goesWrong: { type: 'string' },
          fix: { type: 'string' },
        },
      },
    },
    notes: { type: 'string' },
  },
};

export function detectBackend() {
  if (process.env.SCAN_BACKEND) return process.env.SCAN_BACKEND;
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return 'api';
  if (findClaudeBin()) return 'cli';
  return 'prompt';
}

export function findClaudeBin() {
  if (process.env.CLAUDE_BIN && fs.existsSync(process.env.CLAUDE_BIN)) return process.env.CLAUDE_BIN;
  const r = spawnSync('which', ['claude'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

export async function review({ backend, system, prompt, model = DEFAULT_MODEL, promptFile }) {
  if (backend === 'prompt') {
    fs.writeFileSync(promptFile, `${system}\n\n---\n\n${prompt}\n\n---\n\nAnswer with one JSON object matching this schema:\n${JSON.stringify(RESULT_SCHEMA, null, 1)}\n`);
    return null;
  }
  if (backend === 'cli') return reviewWithCli({ system, prompt, model });
  if (backend === 'api') return reviewWithApi({ system, prompt, model });
  throw new Error(`unknown backend ${backend}`);
}

async function reviewWithApi({ system, prompt, model }) {
  let Anthropic;
  try { ({ default: Anthropic } = await import('@anthropic-ai/sdk')); }
  catch { throw new Error('The api backend needs the SDK: run `npm install` in the review repo.'); }
  const client = new Anthropic();
  const stream = client.messages.stream({
    model,
    max_tokens: 32000,
    system,
    messages: [{ role: 'user', content: prompt }],
    output_config: { effort: 'high', format: { type: 'json_schema', schema: RESULT_SCHEMA } },
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') throw new Error(`Claude declined the request: ${msg.stop_details?.explanation || ''}`);
  if (msg.stop_reason === 'max_tokens') throw new Error('Review was cut off (max_tokens). Scan fewer commits at once.');
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return parseResult(text);
}

function reviewWithCli({ system, prompt, model }) {
  const bin = findClaudeBin();
  if (!bin) throw new Error('Claude Code CLI not found. Set CLAUDE_BIN or use SCAN_BACKEND=api / prompt.');
  const full = `${system}\n\n---\n\n${prompt}\n\nAnswer with ONLY one JSON object (no prose, no code fence) matching this schema:\n${JSON.stringify(RESULT_SCHEMA)}`;
  const args = ['-p', '--output-format', 'json', '--model', model];
  const r = spawnSync(bin, args, { input: full, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, CLAUDECODE: '' } });
  if (r.status !== 0) throw new Error(`claude CLI failed (${r.status}): ${r.stderr.slice(0, 500)}`);
  let text = r.stdout;
  try { const j = JSON.parse(r.stdout); text = j.result ?? j.content ?? r.stdout; } catch {}
  return parseResult(text);
}

export function parseResult(text) {
  const t = String(text).trim();
  const candidates = [t];
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) candidates.unshift(fence[1]);
  const brace = t.indexOf('{'), last = t.lastIndexOf('}');
  if (brace >= 0 && last > brace) candidates.push(t.slice(brace, last + 1));
  for (const c of candidates) {
    try {
      const j = JSON.parse(c);
      if (j && Array.isArray(j.resolved) && Array.isArray(j.new)) return { resolved: j.resolved, new: j.new, notes: j.notes || '' };
    } catch {}
  }
  throw new Error(`Could not parse the review result as JSON:\n${t.slice(0, 800)}`);
}
