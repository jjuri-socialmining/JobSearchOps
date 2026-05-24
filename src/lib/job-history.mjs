import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const HISTORY_PATH = join(process.cwd(), 'tmp/job-history.json');

let _store = null;

function load() {
  if (_store) return _store;
  if (existsSync(HISTORY_PATH)) {
    try { _store = JSON.parse(readFileSync(HISTORY_PATH, 'utf8')); }
    catch { _store = {}; }
  } else {
    _store = {};
  }
  return _store;
}

export function flush() {
  mkdirSync(join(process.cwd(), 'tmp'), { recursive: true });
  writeFileSync(HISTORY_PATH, JSON.stringify(_store ?? {}, null, 2), 'utf8');
}

export function upsert(job) {
  const store = load();
  const now = new Date().toISOString();
  const id = job.job_id ?? job.id;
  if (!id) return null;

  if (store[id]) {
    const e = store[id];
    e.last_seen = now;
    if (job.score != null) e.score = job.score;
    if (job.title) e.title = job.title;
    if (job.company || job.organization) e.company = job.company ?? job.organization;
    if (job.url || job.apply_url) e.url = job.url ?? job.apply_url;
    if (e.status === 'new' || e.status === 'seen') e.status = 'seen';
  } else {
    store[id] = {
      job_id: id,
      title: job.title ?? '',
      company: job.company ?? job.organization ?? '',
      url: job.url ?? job.apply_url ?? '',
      first_seen: now,
      last_seen: now,
      score: job.score ?? 0,
      status: 'new',
      dismiss_reason: null,
      dismiss_date: null,
    };
  }
  return store[id];
}

export function dismiss(job_id, reason = '') {
  const store = load();
  if (!store[job_id]) return false;
  store[job_id].status = 'dismissed';
  store[job_id].dismiss_reason = reason;
  store[job_id].dismiss_date = new Date().toISOString();
  return true;
}

export function getActive() {
  return Object.values(load()).filter(j => j.status === 'new' || j.status === 'seen');
}

export function getHistory() {
  return Object.values(load());
}

export function getStats() {
  const all = Object.values(load());
  return {
    total: all.length,
    new: all.filter(j => j.status === 'new').length,
    seen: all.filter(j => j.status === 'seen').length,
    dismissed: all.filter(j => j.status === 'dismissed').length,
    applied: all.filter(j => j.status === 'applied').length,
  };
}
