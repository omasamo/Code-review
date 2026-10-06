import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export function git(repo, args, { allowFail = false } = {}) {
  const r = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0 && !allowFail) throw new Error(`git ${args.join(' ')} failed: ${r.stderr.trim()}`);
  return r.stdout;
}

export function resolveRepo(explicit) {
  const candidates = [explicit, process.env.APP_REPO, path.resolve(process.cwd(), '..', 'tinnitus-app'), path.resolve(process.cwd(), 'tinnitus-app')].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(path.join(c, '.git')) || fs.existsSync(path.join(c, 'package.json'))) return path.resolve(c);
  throw new Error('App repository not found. Pass --repo <path> or set APP_REPO.');
}

export function revParse(repo, ref) {
  return git(repo, ['rev-parse', '--verify', `${ref}^{commit}`]).trim();
}

export function changedFiles(repo, base, head) {
  return git(repo, ['diff', '--name-status', `${base}..${head}`]).trim().split('\n').filter(Boolean).map((l) => {
    const [status, a, b] = l.split('\t');
    return { status: status[0], file: b || a, from: b ? a : null };
  });
}

export function diff(repo, base, head, files) {
  return git(repo, ['diff', '--unified=6', '--no-color', `${base}..${head}`, '--', ...files]);
}

export function show(repo, ref, file) {
  return git(repo, ['show', `${ref}:${file}`], { allowFail: true });
}

export function exists(repo, ref, file) {
  const r = spawnSync('git', ['-C', repo, 'cat-file', '-e', `${ref}:${file}`]);
  return r.status === 0;
}

export function log(repo, base, head) {
  return git(repo, ['log', '--format=%h %ad %s', '--date=short', `${base}..${head}`]).trim();
}
