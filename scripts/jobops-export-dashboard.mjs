import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot  = path.resolve(__dirname, "..");

function loadEnv() {
  const p = path.join(repoRoot, ".env");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim(), v = t.slice(eq + 1).trim();
    if (k && !(k in process.env)) process.env[k] = v;
  }
}
loadEnv();

// ── Parse keywords.yaml (no external deps) ───────────────────────────────────
function readYamlList(yaml, key) {
  const lines = yaml.split("\n");
  const out = [];
  let active = false;
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "");          // strip comments
    if (line.trimEnd() === key + ":") { active = true; continue; }
    if (active) {
      if (/^\s+-\s/.test(line)) {
        out.push(line.replace(/^\s+-\s+/, "").replace(/^["']|["']$/g, "").trim());
      } else if (/^\S/.test(line.trim()) && line.trim()) {
        active = false;
      }
    }
  }
  return out;
}

const kwPath = path.join(repoRoot, "config/keywords.yaml");
const kwRaw  = fs.existsSync(kwPath) ? fs.readFileSync(kwPath, "utf8") : "";
const KEYWORDS = {
  level_1_keywords:                  readYamlList(kwRaw, "level_1_keywords"),
  level_1_excluded_title_keywords:   readYamlList(kwRaw, "level_1_excluded_title_keywords"),
  level_1_excluded_exact_titles:     readYamlList(kwRaw, "level_1_excluded_exact_titles"),
  level_1_excluded_organizations:    readYamlList(kwRaw, "level_1_excluded_organizations"),
  level_1_excluded_post_keywords:    readYamlList(kwRaw, "level_1_excluded_post_keywords"),
  level_1_excluded_work_options:     readYamlList(kwRaw, "level_1_excluded_work_options"),
};

// ── Build HTML ────────────────────────────────────────────────────────────────
function buildDashboard(jobs, meta) {
  const J = JSON.stringify(jobs);
  const M = JSON.stringify(meta);
  const K = JSON.stringify(KEYWORDS);

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>JobSearchOps Dashboard</title>
<style>
  :root{
    --bg:#0f1117;--surface:#1a1d27;--surface2:#22263a;--border:#2e3347;
    --text:#e2e8f0;--muted:#8892a4;--accent:#6366f1;
    --green:#10b981;--yellow:#f59e0b;--red:#ef4444;
    --blue:#3b82f6;--purple:#8b5cf6;--orange:#f97316;
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:13px;display:flex;flex-direction:column;min-height:100vh;}

  /* ── Header ── */
  .header{padding:14px 24px 10px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;}
  .header-left h1{font-size:16px;font-weight:700;letter-spacing:-.3px;}
  .header-left .sub{color:var(--muted);font-size:11px;margin-top:2px;}
  .stats{display:flex;gap:12px;flex-wrap:wrap;}
  .stat{text-align:center;min-width:44px;}
  .stat .val{font-size:18px;font-weight:700;line-height:1;}
  .stat .lbl{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-top:2px;}
  .stat.green .val{color:var(--green);}.stat.yellow .val{color:var(--yellow);}
  .stat.blue .val{color:var(--blue);}.stat.red .val{color:var(--red);}
  .stat.orange .val{color:var(--orange);}.stat.muted .val{color:var(--muted);}

  /* ── Tab nav ── */
  .tab-nav{display:flex;gap:0;border-bottom:1px solid var(--border);background:var(--surface2);padding:0 24px;}
  .tab-btn{padding:10px 16px;font-size:12px;font-weight:600;color:var(--muted);background:transparent;border:none;border-bottom:2px solid transparent;cursor:pointer;white-space:nowrap;transition:color .15s;}
  .tab-btn:hover{color:var(--text);}
  .tab-btn.active{color:var(--accent);border-bottom-color:var(--accent);}
  .tab-count{display:inline-block;background:var(--border);color:var(--muted);border-radius:10px;font-size:10px;padding:1px 6px;margin-left:5px;font-weight:400;}
  .tab-btn.active .tab-count{background:rgba(99,102,241,.2);color:var(--accent);}

  /* ── Filters ── */
  .filters{padding:8px 24px;border-bottom:1px solid var(--border);display:flex;gap:7px;flex-wrap:wrap;align-items:center;background:var(--surface);}
  .filters input[type=text]{background:var(--bg);border:1px solid var(--border);color:var(--text);padding:5px 10px;border-radius:5px;font-size:12px;width:175px;outline:none;}
  .filters input[type=text]:focus{border-color:var(--accent);}
  .filters select{background:var(--bg);border:1px solid var(--border);color:var(--text);padding:5px 9px;border-radius:5px;font-size:12px;outline:none;cursor:pointer;}
  .toggle-btn{background:transparent;border:1px solid var(--border);color:var(--muted);padding:5px 10px;border-radius:5px;font-size:11px;cursor:pointer;white-space:nowrap;}
  .toggle-btn.active{border-color:var(--accent);color:var(--accent);background:rgba(99,102,241,.08);}
  .btn-clear{background:transparent;border:1px solid var(--border);color:var(--muted);padding:5px 10px;border-radius:5px;font-size:11px;cursor:pointer;}
  .btn-clear:hover{border-color:var(--red);color:var(--red);}

  /* ── Tab toolbar (for secondary tabs) ── */
  .tab-toolbar{padding:10px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:var(--surface);}
  .tab-toolbar .info{color:var(--muted);font-size:11px;}
  .btn-export{background:var(--accent);color:#fff;border:none;padding:6px 14px;border-radius:5px;font-size:12px;font-weight:600;cursor:pointer;}
  .btn-export:hover{opacity:.85;}
  .btn-export.green{background:var(--green);}
  .btn-export.disabled{background:var(--border);color:var(--muted);cursor:not-allowed;}

  /* ── Table shared ── */
  .table-wrap{flex:1;overflow-x:auto;}
  table{width:100%;border-collapse:collapse;}
  thead th{background:var(--surface2);color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.5px;font-weight:600;padding:9px 10px;text-align:left;border-bottom:1px solid var(--border);white-space:nowrap;cursor:pointer;user-select:none;position:sticky;top:0;z-index:10;}
  thead th:hover{color:var(--text);}
  thead th.sorted-asc::after{content:" ↑";color:var(--accent);}
  thead th.sorted-desc::after{content:" ↓";color:var(--accent);}
  thead th.no-sort{cursor:default;}thead th.no-sort:hover{color:var(--muted);}
  tbody tr{border-bottom:1px solid var(--border);transition:background .1s;}
  tbody tr:hover{background:var(--surface);}
  tbody tr.processed{opacity:.3;}tbody tr.closed{opacity:.45;}
  tbody tr.unverified{background:rgba(245,158,11,.03);}
  tbody td{padding:8px 10px;vertical-align:middle;}
  .no-results{text-align:center;padding:48px;color:var(--muted);}

  /* ── Action buttons (main table) ── */
  .actions-cell{display:flex;gap:4px;align-items:center;}
  .btn-act{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:4px;border:none;cursor:pointer;font-size:13px;transition:opacity .15s,transform .1s;}
  .btn-act:hover{opacity:.8;transform:scale(1.08);}
  .btn-apply  {background:rgba(16,185,129,.2);color:var(--green);border:1px solid rgba(16,185,129,.35);}
  .btn-discard{background:rgba(239,68,68,.2);color:var(--red);border:1px solid rgba(239,68,68,.35);}
  .btn-archive{background:rgba(245,158,11,.2);color:var(--yellow);border:1px solid rgba(245,158,11,.35);}

  /* ── Exclusion toggle buttons (discarded table) ── */
  .excl-btn{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:4px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:11px;cursor:pointer;white-space:nowrap;transition:all .15s;}
  .excl-btn:hover{border-color:var(--accent);color:var(--text);}
  .excl-btn.active{background:rgba(16,185,129,.15);border-color:var(--green);color:var(--green);}
  .excl-col{display:flex;flex-direction:column;gap:4px;}

  /* ── Score bar ── */
  .score-wrap{display:flex;align-items:center;gap:6px;}
  .score-bar{width:42px;height:4px;background:var(--border);border-radius:2px;overflow:hidden;flex-shrink:0;}
  .score-fill{height:100%;border-radius:2px;}
  .score-fill.high{background:var(--green);}.score-fill.mid{background:var(--yellow);}.score-fill.low{background:var(--red);}
  .score-num{font-size:12px;font-weight:600;}

  /* ── Badges ── */
  .badge{display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.3px;white-space:nowrap;}
  .badge-green {background:rgba(16,185,129,.15);color:var(--green);border:1px solid rgba(16,185,129,.3);}
  .badge-yellow{background:rgba(245,158,11,.15);color:var(--yellow);border:1px solid rgba(245,158,11,.3);}
  .badge-red   {background:rgba(239,68,68,.15);color:var(--red);border:1px solid rgba(239,68,68,.3);}
  .badge-blue  {background:rgba(59,130,246,.15);color:var(--blue);border:1px solid rgba(59,130,246,.3);}
  .badge-orange{background:rgba(249,115,22,.15);color:var(--orange);border:1px solid rgba(249,115,22,.3);}
  .badge-purple{background:rgba(139,92,246,.15);color:var(--purple);border:1px solid rgba(139,92,246,.3);}
  .badge-muted {background:rgba(136,146,164,.1);color:var(--muted);border:1px solid rgba(136,146,164,.2);}

  /* ── Cells ── */
  .cell-title{font-weight:600;max-width:200px;}
  .cell-org{color:var(--muted);font-size:11px;max-width:140px;}
  .cell-loc{color:var(--muted);font-size:11px;max-width:130px;}
  .cell-comp{color:var(--green);font-size:11px;white-space:nowrap;}
  .cell-why{max-width:180px;font-size:11px;line-height:1.4;}
  .cell-val{max-width:160px;font-size:11px;color:var(--muted);line-height:1.4;}
  .cell-jd{max-width:220px;font-size:11px;line-height:1.45;color:var(--text);}
  .cell-date{color:var(--muted);font-size:11px;white-space:nowrap;}
  .cell-run{color:var(--accent);font-size:11px;white-space:nowrap;font-weight:600;}
  .cell-reason{max-width:200px;font-size:11px;color:var(--text);line-height:1.4;font-style:italic;}
  .cell-empty{color:#3a3f55;font-size:11px;}
  .link-btn{display:inline-block;background:var(--accent);color:#fff;padding:3px 9px;border-radius:4px;font-size:11px;font-weight:600;text-decoration:none;white-space:nowrap;}
  .link-btn:hover{opacity:.85;}
  .link-btn.closed{background:#2e3347;color:var(--muted);pointer-events:none;}
  .closed-badge{display:inline-block;padding:1px 5px;border-radius:3px;font-size:9px;font-weight:700;text-transform:uppercase;background:rgba(239,68,68,.12);color:var(--red);border:1px solid rgba(239,68,68,.25);margin-left:4px;vertical-align:middle;}
  .unverified-badge{display:inline-block;padding:1px 5px;border-radius:3px;font-size:9px;font-weight:700;text-transform:uppercase;background:rgba(245,158,11,.12);color:var(--yellow);border:1px solid rgba(245,158,11,.3);margin-left:4px;vertical-align:middle;cursor:help;}

  /* ── JD keyword highlight ── */
  mark{background:rgba(99,102,241,.28);color:var(--text);border-radius:2px;padding:0 2px;font-style:normal;}

  /* ── Empty tab state ── */
  .empty-state{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:var(--muted);padding:60px;}
  .empty-state .icon{font-size:40px;}
  .empty-state p{font-size:13px;max-width:320px;text-align:center;line-height:1.6;}

  /* ── Modal ── */
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;z-index:1000;backdrop-filter:blur(2px);}
  .modal-overlay.hidden{display:none;}
  .modal{background:var(--surface);border:1px solid var(--border);border-radius:10px;width:440px;max-width:92vw;box-shadow:0 20px 60px rgba(0,0,0,.5);}
  .modal-header{padding:16px 20px 0;display:flex;align-items:center;gap:10px;}
  .modal-icon{font-size:22px;}.modal-title{font-size:15px;font-weight:700;}
  .modal-body{padding:14px 20px;}
  .modal-job-title{font-size:12px;color:var(--muted);margin-bottom:10px;border-left:2px solid var(--border);padding-left:8px;}
  .modal-question{font-size:13px;margin-bottom:6px;}.modal-hint{font-size:11px;color:var(--muted);margin-bottom:10px;}
  .modal textarea{width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:8px 10px;border-radius:6px;font-size:12px;resize:vertical;min-height:72px;outline:none;font-family:inherit;}
  .modal textarea:focus{border-color:var(--accent);}
  .modal-footer{padding:12px 20px 16px;display:flex;gap:8px;justify-content:flex-end;}
  .btn-cancel{background:transparent;border:1px solid var(--border);color:var(--muted);padding:7px 16px;border-radius:6px;font-size:12px;cursor:pointer;}
  .btn-cancel:hover{border-color:var(--red);color:var(--red);}
  .btn-confirm{padding:7px 18px;border-radius:6px;font-size:12px;font-weight:600;border:none;cursor:pointer;}
  .btn-confirm.apply{background:var(--green);color:#fff;}
  .btn-confirm.discard{background:var(--red);color:#fff;}
  .btn-confirm.archive{background:var(--yellow);color:#000;}

  /* ── Pagination ── */
  .pager{background:var(--surface2);border-top:1px solid var(--border);padding:8px 16px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
  .pager-left{display:flex;gap:4px;}
  .pager-btn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:4px;border:1px solid var(--border);background:var(--surface);color:var(--muted);cursor:pointer;font-size:14px;transition:all .15s;}
  .pager-btn:hover:not(:disabled){background:var(--accent);color:#fff;border-color:var(--accent);}
  .pager-btn:disabled{opacity:.3;cursor:not-allowed;}
  .pager-center{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;color:var(--muted);font-size:12px;}
  .pager-center input{width:40px;text-align:center;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:4px 6px;border-radius:4px;font-size:12px;outline:none;}
  .pager-center input:focus{border-color:var(--accent);}
  .pager-right{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:11px;white-space:nowrap;}
  .pager-right select{background:var(--bg);border:1px solid var(--border);color:var(--text);padding:4px 8px;border-radius:4px;font-size:11px;outline:none;cursor:pointer;}

  /* ── Roles Manager ── */
  .roles-body{display:flex;flex:1;overflow:hidden;}
  .roles-left{flex:1;overflow-y:auto;padding:16px 20px;border-right:1px solid var(--border);}
  .roles-right{width:300px;overflow-y:auto;padding:16px 20px;background:var(--surface2);}
  .roles-section-title{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);font-weight:600;margin:0 0 10px;}
  .roles-add-row{display:flex;gap:8px;margin-bottom:16px;}
  .roles-add-row input{flex:1;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:6px 10px;border-radius:5px;font-size:12px;outline:none;}
  .roles-add-row input:focus{border-color:var(--accent);}
  .roles-table{width:100%;border-collapse:collapse;}
  .roles-table th{background:var(--surface2);color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.5px;font-weight:600;padding:7px 10px;text-align:left;border-bottom:1px solid var(--border);}
  .roles-table td{padding:7px 10px;border-bottom:1px solid var(--border);font-size:12px;vertical-align:middle;}
  .roles-table tr.removed td{opacity:.35;}
  .roles-hint{font-size:11px;color:var(--muted);line-height:1.5;margin-bottom:12px;}
  .sug-item{display:flex;align-items:center;gap:7px;padding:6px 8px;border:1px solid var(--border);border-radius:4px;margin-bottom:4px;background:var(--surface);font-size:11px;}
  .sug-item-name{flex:1;color:var(--text);}
  .sug-score{color:var(--muted);font-size:10px;white-space:nowrap;}
  .btn-sug-add{background:rgba(16,185,129,.15);color:var(--green);border:1px solid rgba(16,185,129,.3);padding:2px 8px;border-radius:4px;font-size:11px;cursor:pointer;white-space:nowrap;}
  .btn-sug-add:hover{background:rgba(16,185,129,.3);}
  .btn-sug-add.added{background:rgba(99,102,241,.15);color:var(--accent);border-color:rgba(99,102,241,.3);cursor:default;}

  .hidden{display:none!important;}
</style>
</head>
<body>

<!-- ── Header ─────────────────────────────────────────────────────────────── -->
<div class="header">
  <div class="header-left">
    <h1>JobSearchOps Dashboard</h1>
    <div class="sub" id="run-meta"></div>
  </div>
  <div class="stats">
    <div class="stat green" ><div class="val" id="cnt-apply">0</div><div class="lbl">Aplicar</div></div>
    <div class="stat yellow"><div class="val" id="cnt-review">0</div><div class="lbl">Revisar</div></div>
    <div class="stat blue"  ><div class="val" id="cnt-solo">0</div><div class="lbl">Solo si aclaran</div></div>
    <div class="stat red"   ><div class="val" id="cnt-closed">0</div><div class="lbl">Cerradas</div></div>
    <div class="stat orange"><div class="val" id="cnt-desc">0</div><div class="lbl">Descartadas</div></div>
    <div class="stat muted" ><div class="val" id="cnt-total">0</div><div class="lbl">Total</div></div>
  </div>
</div>

<!-- ── Tab nav ────────────────────────────────────────────────────────────── -->
<div class="tab-nav">
  <button class="tab-btn active" onclick="showTab('activas')">Activas <span class="tab-count" id="tc-activas">0</span></button>
  <button class="tab-btn"        onclick="showTab('descartadas')">Descartadas <span class="tab-count" id="tc-descartadas">0</span></button>
  <button class="tab-btn"        onclick="showTab('archivadas')">Archivadas <span class="tab-count" id="tc-archivadas">0</span></button>
  <button class="tab-btn"        onclick="showTab('aplicadas')">Aplicadas <span class="tab-count" id="tc-aplicadas">0</span></button>
  <button class="tab-btn"        onclick="showTab('roles')">⚙ Roles <span class="tab-count" id="tc-roles">0</span></button>
</div>

<!-- ══════════════════════════════════════════════════════════════════════════
     TAB: ACTIVAS
     ══════════════════════════════════════════════════════════════════════ -->
<div id="tab-activas">
  <div class="filters">
    <input type="text" id="search" placeholder="Título, organización…">
    <select id="fil-veredicto">
      <option value="">Veredicto (todos)</option>
      <option value="APPLY">APLICAR</option>
      <option value="REVIEW">REVISAR</option>
      <option value="APPLY_ONLY_IF_CLARIFIED">SOLO SI ACLARAN</option>
      <option value="DISCARD">DESCARTAR</option>
    </select>
    <select id="fil-prioridad">
      <option value="">Prioridad (todas)</option>
      <option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option>
    </select>
    <select id="fil-source"><option value="">Fuente (todas)</option></select>
    <select id="fil-modalidad">
      <option value="">Modalidad (todas)</option>
      <option value="Hybrid">Hybrid</option><option value="Remote">Remote</option>
    </select>
    <button class="toggle-btn active" id="btn-hide-closed"      onclick="toggleClosed()">Ocultar cerradas</button>
    <button class="toggle-btn"        id="btn-hide-unverified"  onclick="toggleUnverified()">Ocultar no verificadas</button>
    <button class="toggle-btn active" id="btn-hide-proc"        onclick="toggleProc()">Ocultar procesadas</button>
    <button class="btn-clear" onclick="clearFilters()">Limpiar</button>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr>
        <th class="no-sort" style="width:90px">Acciones</th>
        <th data-col="run_date">Corrida</th>
        <th data-col="captured_at">Captura</th>
        <th data-col="posted_at">Posted</th>
        <th data-col="industry">Industry</th>
        <th data-col="score" class="sorted-desc">Ranking</th>
        <th data-col="priority">Prioridad</th>
        <th data-col="veredicto">Veredicto</th>
        <th data-col="source_id">Fuente</th>
        <th data-col="organization">Organización</th>
        <th data-col="title">Título</th>
        <th data-col="location">Ubicación / Modalidad</th>
        <th data-col="compensation">Compensación</th>
        <th data-col="why_now">Por qué mirar primero</th>
        <th data-col="open_questions">Qué falta validar</th>
        <th class="no-sort">Highlight</th>
        <th class="no-sort">Link</th>
      </tr></thead>
      <tbody id="tbody-activas"></tbody>
    </table>
  </div>
  <div class="pager">
    <div class="pager-left">
      <button class="pager-btn" onclick="clearFilters()" title="Limpiar filtros">↺</button>
    </div>
    <div class="pager-center">
      <button class="pager-btn" id="pg-first" onclick="setPage(1)">⟨⟨</button>
      <button class="pager-btn" id="pg-prev"  onclick="prevPage()">⟨</button>
      <span>Página</span>
      <input type="number" id="pg-input" min="1" value="1" onchange="goToPage(this.value)">
      <span>de</span><span id="pg-total">1</span>
      <button class="pager-btn" id="pg-next" onclick="nextPage()">⟩</button>
      <button class="pager-btn" id="pg-last" onclick="lastPage()">⟩⟩</button>
    </div>
    <div class="pager-right">
      <select id="pg-size" onchange="changePageSize(this.value)">
        <option value="10" selected>10</option>
        <option value="25">25</option><option value="50">50</option><option value="100">100</option>
      </select>
      <span id="pager-info">View 0 – 0 of 0</span>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════════════════════
     TAB: DESCARTADAS
     ══════════════════════════════════════════════════════════════════════ -->
<div id="tab-descartadas" class="hidden" style="display:flex;flex-direction:column;flex:1;">
  <div class="tab-toolbar">
    <button class="btn-export green" onclick="exportKeywordsYaml()">⬇ Descargar keywords.yaml actualizado</button>
    <span class="info" id="rules-info">Seleccioná reglas para aplicar en la próxima búsqueda</span>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr>
        <th>Fecha descarte</th>
        <th>Título</th>
        <th>Organización</th>
        <th>Fuente</th>
        <th>Observación</th>
        <th class="no-sort">Excluir de próxima búsqueda</th>
      </tr></thead>
      <tbody id="tbody-descartadas"></tbody>
    </table>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════════════════════
     TAB: ARCHIVADAS
     ══════════════════════════════════════════════════════════════════════ -->
<div id="tab-archivadas" class="hidden" style="display:flex;flex-direction:column;flex:1;">
  <div class="tab-toolbar">
    <span class="info">Ofertas archivadas para revisar más tarde.</span>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr>
        <th>Fecha archivo</th><th>Título</th><th>Organización</th>
        <th>Fuente</th><th>Observación</th><th class="no-sort">Acciones</th>
      </tr></thead>
      <tbody id="tbody-archivadas"></tbody>
    </table>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════════════════════
     TAB: APLICADAS
     ══════════════════════════════════════════════════════════════════════ -->
<div id="tab-aplicadas" class="hidden" style="display:flex;flex-direction:column;flex:1;">
  <div class="tab-toolbar">
    <span class="info">Ofertas donde iniciaste el proceso de aplicación.</span>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr>
        <th>Fecha</th><th>Título</th><th>Organización</th>
        <th>Fuente</th><th>Por qué aplicaste</th><th class="no-sort">Link</th>
      </tr></thead>
      <tbody id="tbody-aplicadas"></tbody>
    </table>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════════════════════
     TAB: MANTENEDOR DE ROLES
     ══════════════════════════════════════════════════════════════════════ -->
<div id="tab-roles" class="hidden" style="display:flex;flex-direction:column;flex:1;">
  <div class="tab-toolbar">
    <button class="btn-export green" onclick="exportKeywordsYaml()">⬇ Descargar keywords.yaml actualizado</button>
    <span class="info">Guardá el archivo en config/keywords.yaml antes de la próxima corrida para que los cambios tomen efecto.</span>
  </div>
  <div class="roles-body">
    <!-- Panel izquierdo: keywords activos -->
    <div class="roles-left">
      <div class="roles-section-title">Agregar keyword de búsqueda</div>
      <div class="roles-add-row">
        <input type="text" id="role-input" placeholder="Ej: Digital Solutions Manager"
          onkeydown="if(event.key==='Enter')addRole()">
        <button class="btn-export" onclick="addRole()">+ Agregar</button>
      </div>
      <div class="roles-section-title" style="margin-top:8px;">Keywords activos en búsqueda</div>
      <table class="roles-table">
        <thead><tr><th>Keyword / Rol</th><th style="width:70px;">Tipo</th><th style="width:90px;">Acciones</th></tr></thead>
        <tbody id="roles-tbody"></tbody>
      </table>
    </div>
    <!-- Panel derecho: sugeridos desde resultados -->
    <div class="roles-right">
      <div class="roles-section-title">Sugeridos desde resultados actuales</div>
      <p class="roles-hint">Cargos que aparecieron en tu búsqueda. Agregá los que querés buscar explícitamente en la próxima corrida.</p>
      <div id="roles-suggestions"></div>
    </div>
  </div>
</div>

<!-- ── Modal ──────────────────────────────────────────────────────────────── -->
<div class="modal-overlay hidden" id="modal-overlay">
  <div class="modal">
    <div class="modal-header">
      <span class="modal-icon" id="modal-icon"></span>
      <span class="modal-title" id="modal-title"></span>
    </div>
    <div class="modal-body">
      <div class="modal-job-title" id="modal-job-title"></div>
      <div class="modal-question" id="modal-question"></div>
      <div class="modal-hint" id="modal-hint"></div>
      <textarea id="modal-input" placeholder="Tu respuesta (opcional)…"></textarea>
    </div>
    <div class="modal-footer">
      <button class="btn-cancel" onclick="closeModal()">Cancelar</button>
      <button class="btn-confirm" id="modal-confirm-btn" onclick="confirmModal()">Confirmar</button>
    </div>
  </div>
</div>

<script>
// ── Data ──────────────────────────────────────────────────────────────────────
const RAW  = ${J};
const META = ${M};
const KW   = ${K};

const RUN_DATE = META.generated_at
  ? new Date(META.generated_at).toLocaleDateString("en-CA",{month:"short",day:"numeric"})
  : "—";

// ── Actions localStorage ──────────────────────────────────────────────────────
const AK = "jobops_actions";
function loadActions(){ try{ return JSON.parse(localStorage.getItem(AK)||"{}"); }catch{ return {}; } }
function saveActions(m){ localStorage.setItem(AK,JSON.stringify(m)); }
function getAction(url){ return loadActions()[url]||null; }
function setAction(url,obj){ const m=loadActions(); m[url]=obj; saveActions(m); }
let ACTIONS = loadActions();

// ── Roles localStorage ────────────────────────────────────────────────────────
const RK = "jobops_roles";
function loadRolesState(){ try{ return JSON.parse(localStorage.getItem(RK)||'{"added":[],"removed":[]}'); }catch{ return {added:[],removed:[]}; } }
function saveRolesState(s){ localStorage.setItem(RK,JSON.stringify(s)); }

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(s){ if(!s)return null; const d=new Date(s); if(isNaN(d))return s; return d.toLocaleDateString("en-CA",{month:"short",day:"numeric"}); }
function fmtDateTime(s){ if(!s)return"—"; const d=new Date(s); if(isNaN(d))return s; return d.toLocaleDateString("en-CA",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}); }
function esc(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function scoreColor(n){ return n>=80?"high":n>=60?"mid":"low"; }
function veredictoClass(v){
  const u=(v||"").toUpperCase();
  if(u==="APPLY")return"badge-green"; if(u==="REVIEW")return"badge-yellow";
  if(u==="APPLY_ONLY_IF_CLARIFIED")return"badge-blue"; if(u==="DISCARD")return"badge-red";
  return"badge-muted";
}
function veredictoLabel(v){ return{APPLY:"APLICAR",REVIEW:"REVISAR",APPLY_ONLY_IF_CLARIFIED:"SOLO SI ACLARAN",DISCARD:"DESCARTAR"}[v]||v||"—"; }
function prioClass(p){ return{alta:"badge-green",media:"badge-yellow",baja:"badge-red"}[p]||"badge-muted"; }
function sourceLabel(id){ return{"bc-gov":"BC Gov","adzuna-bc":"Adzuna","civicjobs":"CivicJobs"}[id]||id||"—"; }
function sourceClass(id){ return{"bc-gov":"badge-blue","adzuna-bc":"badge-orange","civicjobs":"badge-purple"}[id]||"badge-muted"; }

// ── Keyword highlighter ───────────────────────────────────────────────────────
const KW_LOWER = KW.level_1_keywords.map(k=>k.toLowerCase());
function highlightKw(raw){
  let s = esc(raw);
  KW_LOWER.forEach(kw=>{
    const re = new RegExp("("+kw+")","gi");
    s = s.replace(re,"<mark>$1</mark>");
  });
  return s;
}

// ── Flatten jobs ──────────────────────────────────────────────────────────────
const JOBS = RAW.map(j=>({
  captured_at:j.captured_at||"", posted_at:j.posted_at||"",
  industry:j.enrichment?.industry||"", applicants:j.enrichment?.applicants||"",
  score:j.score?.total??0, priority:j.score?.priority||"",
  veredicto:j.decision?.status||"",
  organization:j.organization||"", title:j.title||"",
  location:j.location||"", remote_mode:j.remote_mode||"",
  compensation:j.compensation||"",
  why_now:j.decision?.why_now||"", open_questions:j.decision?.open_questions||"",
  apply_url:j.apply_url||"",
  source_name:j.source_name||"", source_id:j.source_id||"",
  is_open:j.is_open,
  jd_highlight:j.jd_highlight||"",
}));

const JOB_MAP = Object.fromEntries(JOBS.map(j=>[j.apply_url,j]));

// ── Source filter populate ────────────────────────────────────────────────────
(function(){
  const sel=document.getElementById("fil-source");
  [...new Set(JOBS.map(j=>j.source_name))].sort().forEach(s=>{
    const o=document.createElement("option"); o.value=s; o.textContent=s; sel.appendChild(o);
  });
})();

// ── Stats ─────────────────────────────────────────────────────────────────────
function updateStats(){
  ACTIONS = loadActions();
  const byType = t => Object.values(ACTIONS).filter(a=>a.action===t).length;
  document.getElementById("cnt-total").textContent  = JOBS.length;
  document.getElementById("cnt-apply").textContent  = JOBS.filter(j=>j.veredicto==="APPLY").length;
  document.getElementById("cnt-review").textContent = JOBS.filter(j=>j.veredicto==="REVIEW").length;
  document.getElementById("cnt-solo").textContent   = JOBS.filter(j=>j.veredicto==="APPLY_ONLY_IF_CLARIFIED").length;
  document.getElementById("cnt-closed").textContent = JOBS.filter(j=>j.is_open===false).length;
  document.getElementById("cnt-desc").textContent   = byType("discard");
  const activeCount = JOBS.filter(j=> !ACTIONS[j.apply_url] && !(hideClosed&&j.is_open===false)).length;
  document.getElementById("tc-activas").textContent     = activeCount;
  document.getElementById("tc-descartadas").textContent = byType("discard");
  document.getElementById("tc-archivadas").textContent  = byType("archive");
  document.getElementById("tc-aplicadas").textContent   = byType("apply");
  // Roles count: base + added - removed
  const rs = loadRolesState();
  const rolesCount = KW.level_1_keywords.filter(r=>!rs.removed.includes(r)).length + rs.added.filter(r=>!KW.level_1_keywords.includes(r)).length;
  document.getElementById("tc-roles").textContent = rolesCount;
  // Rules info
  const rulesCount = Object.values(ACTIONS).filter(a=>a.action==="discard"&&a.rules?.length).reduce((s,a)=>s+a.rules.length,0);
  document.getElementById("rules-info").textContent =
    rulesCount>0 ? rulesCount+" regla"+(rulesCount!==1?"s":"")+" seleccionada"+(rulesCount!==1?"s":"")+" para aplicar" : "Seleccioná reglas para aplicar en la próxima búsqueda";
  if(META.generated_at){
    document.getElementById("run-meta").textContent=
      "Corrida: "+new Date(META.generated_at).toLocaleString("es-CA",{dateStyle:"medium",timeStyle:"short"})+" · "+JOBS.length+" ofertas";
  }
}

// ── Tab navigation ────────────────────────────────────────────────────────────
let activeTab = "activas";
const TAB_IDS = ["activas","descartadas","archivadas","aplicadas","roles"];

function showTab(name){
  activeTab = name;
  TAB_IDS.forEach(t=>{
    const el=document.getElementById("tab-"+t);
    if(el) el.classList.toggle("hidden",t!==name);
    if(el) el.style.display = t===name ? "flex" : "none";
    if(el) el.style.flexDirection = t===name ? "column" : "";
    if(el) el.style.flex = t===name ? "1" : "";
  });
  document.querySelectorAll(".tab-btn").forEach((b,i)=>b.classList.toggle("active",TAB_IDS[i]===name));
  if(name==="descartadas") renderDiscarded();
  else if(name==="archivadas") renderArchived();
  else if(name==="aplicadas") renderApplied();
  else if(name==="roles") renderRoles();
}

// ── Modal ─────────────────────────────────────────────────────────────────────
let _mJob=null, _mType=null;
const MODAL_CFG={
  apply:  {icon:"✅",title:"Aplicar a esta oferta",question:"¿Por qué te llama la atención aplicar?",hint:"Tu respuesta ayuda a refinar el scoring de futuras búsquedas.",cls:"apply",txt:"Aplicar"},
  discard:{icon:"🗑️",title:"Descartar oferta",question:"¿Por qué descartás esta oferta?",hint:"Cuéntanos qué no encajó — mejora los filtros de la próxima búsqueda.",cls:"discard",txt:"Descartar"},
  archive:{icon:"📁",title:"Archivar oferta",question:"¿Por qué archivás esta oferta?",hint:"Timing, falta de info, o revisar después — igual suma.",cls:"archive",txt:"Archivar"},
};
function openModal(url,type){
  _mJob=JOBS.find(j=>j.apply_url===url); _mType=type;
  if(!_mJob)return;
  const c=MODAL_CFG[type];
  document.getElementById("modal-icon").textContent    =c.icon;
  document.getElementById("modal-title").textContent   =c.title;
  document.getElementById("modal-job-title").textContent=_mJob.title+" — "+_mJob.organization;
  document.getElementById("modal-question").textContent=c.question;
  document.getElementById("modal-hint").textContent    =c.hint;
  document.getElementById("modal-input").value="";
  const btn=document.getElementById("modal-confirm-btn");
  btn.textContent=c.txt; btn.className="btn-confirm "+c.cls;
  document.getElementById("modal-overlay").classList.remove("hidden");
  setTimeout(()=>document.getElementById("modal-input").focus(),80);
}
function closeModal(){ document.getElementById("modal-overlay").classList.add("hidden"); _mJob=null;_mType=null; }
function confirmModal(){
  if(!_mJob||!_mType)return;
  const reason=document.getElementById("modal-input").value.trim();
  const existing=getAction(_mJob.apply_url)||{};
  setAction(_mJob.apply_url,{...existing,action:_mType,reason,timestamp:new Date().toISOString(),title:_mJob.title,org:_mJob.organization,source_id:_mJob.source_id,rules:existing.rules||[]});
  ACTIONS=loadActions();
  updateStats();
  closeModal();
  if(_mType==="apply") window.open("apply-wip.html","_blank");
  applyFilters();
}
document.getElementById("modal-overlay").addEventListener("click",function(e){if(e.target===this)closeModal();});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal();});

// ── Restore action from secondary tab ────────────────────────────────────────
function restoreAction(url){
  const m=loadActions(); delete m[url]; saveActions(m);
  ACTIONS=loadActions(); updateStats();
  renderDiscarded(); renderArchived(); renderApplied();
  applyFilters();
}

// ── Exclusion rule toggle (discarded tab) ─────────────────────────────────────
function toggleRule(url, ruleType){
  const m=loadActions();
  if(!m[url]) return;
  const rules = m[url].rules || [];
  const idx = rules.indexOf(ruleType);
  if(idx===-1) rules.push(ruleType); else rules.splice(idx,1);
  m[url].rules = rules;
  saveActions(m); ACTIONS=loadActions();
  updateStats();
  const btn = document.getElementById("rule-btn-"+btoa(url+ruleType).replace(/[^a-z0-9]/gi,"").slice(0,12));
  if(btn) btn.classList.toggle("active", rules.includes(ruleType));
}

// ── Render: DISCARDED ─────────────────────────────────────────────────────────
function renderDiscarded(){
  ACTIONS=loadActions();
  const tbody=document.getElementById("tbody-descartadas");
  const entries=Object.entries(ACTIONS).filter(([,a])=>a.action==="discard");
  if(!entries.length){
    tbody.innerHTML=\`<tr><td colspan="6" class="no-results">No hay ofertas descartadas todavía.</td></tr>\`;
    return;
  }
  tbody.innerHTML=entries.map(([url,a])=>{
    const j=JOB_MAP[url]||{title:a.title||"—",organization:a.org||"—",source_id:a.source_id||"",apply_url:url};
    const rules=a.rules||[];
    const idExact = "rule-btn-"+btoa(url+"exact_title").replace(/[^a-z0-9]/gi,"").slice(0,12);
    const idOrg   = "rule-btn-"+btoa(url+"org").replace(/[^a-z0-9]/gi,"").slice(0,12);
    return \`<tr>
      <td class="cell-date">\${fmtDateTime(a.timestamp)}</td>
      <td><div class="cell-title">\${esc(j.title)}</div></td>
      <td><div class="cell-org">\${esc(j.organization)}</div></td>
      <td><span class="badge \${sourceClass(j.source_id)}">\${sourceLabel(j.source_id)}</span></td>
      <td><div class="cell-reason">\${a.reason?esc(a.reason):\`<span class="cell-empty">Sin observación</span>\`}</div></td>
      <td>
        <div class="excl-col">
          <button id="\${idExact}" class="excl-btn\${rules.includes('exact_title')?' active':''}"
            onclick="toggleRule('\${esc(url)}','exact_title')">
            📌 Excluir título exacto
          </button>
          <button id="\${idOrg}" class="excl-btn\${rules.includes('org')?' active':''}"
            onclick="toggleRule('\${esc(url)}','org')">
            🏢 Excluir organización
          </button>
        </div>
      </td>
    </tr>\`;
  }).join("");
}

// ── Render: ARCHIVED ──────────────────────────────────────────────────────────
function renderArchived(){
  ACTIONS=loadActions();
  const tbody=document.getElementById("tbody-archivadas");
  const entries=Object.entries(ACTIONS).filter(([,a])=>a.action==="archive");
  if(!entries.length){
    tbody.innerHTML=\`<tr><td colspan="6" class="no-results">No hay ofertas archivadas.</td></tr>\`;
    return;
  }
  tbody.innerHTML=entries.map(([url,a])=>{
    const j=JOB_MAP[url]||{title:a.title||"—",organization:a.org||"—",source_id:a.source_id||""};
    return \`<tr>
      <td class="cell-date">\${fmtDateTime(a.timestamp)}</td>
      <td><div class="cell-title">\${esc(j.title)}</div></td>
      <td><div class="cell-org">\${esc(j.organization)}</div></td>
      <td><span class="badge \${sourceClass(j.source_id)}">\${sourceLabel(j.source_id)}</span></td>
      <td><div class="cell-reason">\${a.reason?esc(a.reason):\`<span class="cell-empty">Sin observación</span>\`}</div></td>
      <td><button class="excl-btn" onclick="restoreAction('\${esc(url)}')">↩ Restaurar</button></td>
    </tr>\`;
  }).join("");
}

// ── Render: APPLIED ───────────────────────────────────────────────────────────
function renderApplied(){
  ACTIONS=loadActions();
  const tbody=document.getElementById("tbody-aplicadas");
  const entries=Object.entries(ACTIONS).filter(([,a])=>a.action==="apply");
  if(!entries.length){
    tbody.innerHTML=\`<tr><td colspan="6" class="no-results">Aún no aplicaste a ninguna oferta.</td></tr>\`;
    return;
  }
  tbody.innerHTML=entries.map(([url,a])=>{
    const j=JOB_MAP[url]||{title:a.title||"—",organization:a.org||"—",source_id:a.source_id||"",apply_url:url};
    return \`<tr>
      <td class="cell-date">\${fmtDateTime(a.timestamp)}</td>
      <td><div class="cell-title">\${esc(j.title)}</div></td>
      <td><div class="cell-org">\${esc(j.organization)}</div></td>
      <td><span class="badge \${sourceClass(j.source_id)}">\${sourceLabel(j.source_id)}</span></td>
      <td><div class="cell-reason">\${a.reason?esc(a.reason):\`<span class="cell-empty">Sin motivo registrado</span>\`}</div></td>
      <td>\${j.apply_url?\`<a class="link-btn" href="\${esc(j.apply_url)}" target="_blank" rel="noopener">Ver →</a>\`:"—"}</td>
    </tr>\`;
  }).join("");
}

// ── Roles Manager ─────────────────────────────────────────────────────────────
function addRole(){
  const input = document.getElementById("role-input");
  const val   = input.value.trim();
  if(!val) return;
  const rs = loadRolesState();
  if(!KW.level_1_keywords.includes(val) && !rs.added.includes(val)){
    rs.added.push(val);
    saveRolesState(rs);
  }
  input.value="";
  renderRoles();
  updateStats();
}

function removeRole(role){
  const rs = loadRolesState();
  if(KW.level_1_keywords.includes(role)){
    if(!rs.removed.includes(role)) rs.removed.push(role);
  } else {
    rs.added = rs.added.filter(r=>r!==role);
  }
  saveRolesState(rs);
  renderRoles();
  updateStats();
}

function restoreRole(role){
  const rs = loadRolesState();
  rs.removed = rs.removed.filter(r=>r!==role);
  saveRolesState(rs);
  renderRoles();
  updateStats();
}

function renderRoles(){
  const rs   = loadRolesState();
  const base = KW.level_1_keywords;
  const items = [
    ...base.map(r=>({role:r,isBase:true,removed:rs.removed.includes(r)})),
    ...rs.added.filter(r=>!base.includes(r)).map(r=>({role:r,isBase:false,removed:false})),
  ];
  document.getElementById("roles-tbody").innerHTML = items.map(({role,isBase,removed})=>\`
    <tr class="\${removed?"removed":""}">
      <td style="font-weight:\${removed?"400":"500"};color:\${removed?"var(--muted)":"var(--text)"};">\${esc(role)}</td>
      <td>\${isBase
        ?'<span class="badge badge-blue">Base</span>'
        :'<span class="badge badge-green">Nuevo</span>'
      }</td>
      <td>\${removed
        ?\`<button class="excl-btn active" onclick="restoreRole('\${esc(role)}')">↩ Restaurar</button>\`
        :\`<button class="excl-btn" style="color:var(--red);border-color:rgba(239,68,68,.3);" onclick="removeRole('\${esc(role)}')">× Quitar</button>\`
      }</td>
    </tr>
  \`).join("");
  renderRoleSuggestions(rs);
}

function renderRoleSuggestions(rs){
  const base = KW.level_1_keywords;
  const allActive = [...base.filter(r=>!(rs||loadRolesState()).removed.includes(r)),
                     ...(rs||loadRolesState()).added.filter(r=>!base.includes(r))];
  const activeLower = allActive.map(k=>k.toLowerCase());

  // Job titles from open/unverified jobs not already exact-matched by a keyword
  const seen = new Set();
  const suggestions = JOBS
    .filter(j=>j.is_open!==false)
    .sort((a,b)=>b.score-a.score)
    .map(j=>({title:j.title, score:j.score}))
    .filter(({title})=>{
      const t = title.toLowerCase();
      if(seen.has(t)) return false;
      seen.add(t);
      return !activeLower.includes(t);  // not already an exact keyword
    })
    .slice(0,20);

  const container = document.getElementById("roles-suggestions");
  if(!suggestions.length){
    container.innerHTML='<p style="font-size:11px;color:var(--muted);">Todos los cargos ya están cubiertos por keywords activos.</p>';
    return;
  }
  container.innerHTML = suggestions.map(({title,score})=>{
    const alreadyAdded = (rs||loadRolesState()).added.map(r=>r.toLowerCase()).includes(title.toLowerCase());
    return \`<div class="sug-item">
      <span class="sug-item-name">\${esc(title)}</span>
      <span class="sug-score">\${score}p</span>
      <button class="btn-sug-add\${alreadyAdded?" added":""}"
        onclick="addRoleFromSuggestion('\${esc(title)}')"
        \${alreadyAdded?"disabled":""}>
        \${alreadyAdded?"✓ Agregado":"+ Agregar"}
      </button>
    </div>\`;
  }).join("");
}

function addRoleFromSuggestion(title){
  const rs = loadRolesState();
  const base = KW.level_1_keywords;
  if(!base.map(r=>r.toLowerCase()).includes(title.toLowerCase()) && !rs.added.map(r=>r.toLowerCase()).includes(title.toLowerCase())){
    rs.added.push(title);
    saveRolesState(rs);
  }
  renderRoles();
  updateStats();
}

// ── Export keywords.yaml (used by Descartadas + Roles tabs) ──────────────────
function exportKeywordsYaml(){
  ACTIONS = loadActions();
  const rs = loadRolesState();

  // Merge role changes
  const effectiveRoles = [
    ...KW.level_1_keywords.filter(r=>!rs.removed.includes(r)),
    ...rs.added.filter(r=>!KW.level_1_keywords.includes(r)),
  ];

  // Merge exclusion rules from discarded jobs
  const discards = Object.values(ACTIONS).filter(a=>a.action==="discard"&&a.rules?.length);
  const newExactTitles = [...KW.level_1_excluded_exact_titles];
  const newExclOrgs    = [...KW.level_1_excluded_organizations];
  for(const a of discards){
    if(a.rules.includes("exact_title") && a.title && !newExactTitles.includes(a.title))
      newExactTitles.push(a.title);
    if(a.rules.includes("org") && a.org && !newExclOrgs.includes(a.org))
      newExclOrgs.push(a.org);
  }

  function yamlList(key, items, comment){
    let s = (comment?comment+"\\n":"")+key+":\\n";
    if(!items.length) return s+"  []\\n";
    return s + items.map(v=>\`  - "\${v.replace(/"/g,'\\\\"')}"\`).join("\\n")+"\\n";
  }

  const now = new Date().toISOString().slice(0,10);
  const addedRoles = rs.added.filter(r=>!KW.level_1_keywords.includes(r));
  const yaml = [
    \`# JobSearchOps — Level 1 Keyword Filters\`,
    \`# Exportado desde dashboard: \${now}\`,
    \`# Roles nuevos: \${addedRoles.length} · Reglas exclusión aplicadas: \${discards.filter(a=>a.rules?.length).length}\`,
    \`\`,
    yamlList("level_1_keywords", effectiveRoles,
      addedRoles.length>0?\`# +\${addedRoles.length} rol(es) agregado(s): \${addedRoles.join(", ")}\`:null),
    yamlList("level_1_excluded_title_keywords", KW.level_1_excluded_title_keywords),
    yamlList("level_1_excluded_exact_titles", newExactTitles,
      \`# \${newExactTitles.length-KW.level_1_excluded_exact_titles.length} nueva(s) desde descartadas\`),
    yamlList("level_1_excluded_organizations", newExclOrgs,
      \`# \${newExclOrgs.length-KW.level_1_excluded_organizations.length} nueva(s) desde descartadas\`),
    yamlList("level_1_excluded_post_keywords", KW.level_1_excluded_post_keywords),
    yamlList("level_1_excluded_work_options",  KW.level_1_excluded_work_options),
  ].join("\\n");

  const blob = new Blob([yaml],{type:"text/yaml"});
  const a = document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="keywords.yaml";
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Activas: sort + pagination ────────────────────────────────────────────────
let sortCol="score", sortDir=-1, filteredList=[], currentPage=1, pageSize=10;
let hideClosed=true, hideUnverified=false, hideProc=true;

function toggleClosed(){
  hideClosed=!hideClosed;
  document.getElementById("btn-hide-closed").classList.toggle("active",hideClosed);
  applyFilters();
}
function toggleUnverified(){
  hideUnverified=!hideUnverified;
  document.getElementById("btn-hide-unverified").classList.toggle("active",hideUnverified);
  applyFilters();
}
function toggleProc(){
  hideProc=!hideProc;
  document.getElementById("btn-hide-proc").classList.toggle("active",hideProc);
  applyFilters();
}

function sortValue(j,col){
  if(col==="score") return j.score;
  if(col==="captured_at"||col==="posted_at") return new Date(j[col]||0).getTime();
  return (j[col]||"").toLowerCase();
}
function setPage(n){ const t=Math.max(1,Math.ceil(filteredList.length/pageSize)); currentPage=Math.max(1,Math.min(n,t)); renderActivasPage(); }
function prevPage(){ setPage(currentPage-1); }
function nextPage(){ setPage(currentPage+1); }
function lastPage(){ setPage(Math.ceil(filteredList.length/pageSize)); }
function goToPage(v){ setPage(parseInt(v)||1); }
function changePageSize(v){ pageSize=parseInt(v)||10; setPage(1); }

function renderActivasPage(){
  const total=Math.max(1,Math.ceil(filteredList.length/pageSize));
  const start=(currentPage-1)*pageSize, end=Math.min(start+pageSize,filteredList.length);
  const page=filteredList.slice(start,end);
  document.getElementById("pg-input").value=currentPage;
  document.getElementById("pg-total").textContent=total;
  document.getElementById("pg-first").disabled=currentPage<=1;
  document.getElementById("pg-prev").disabled=currentPage<=1;
  document.getElementById("pg-next").disabled=currentPage>=total;
  document.getElementById("pg-last").disabled=currentPage>=total;
  document.getElementById("pager-info").textContent=
    \`View \${filteredList.length?start+1:0} – \${end} of \${filteredList.length}\`;

  const tbody=document.getElementById("tbody-activas");
  if(!page.length){ tbody.innerHTML=\`<tr><td colspan="17" class="no-results">No hay resultados con estos filtros.</td></tr>\`; return; }

  tbody.innerHTML=page.map(j=>{
    const isProc=!!ACTIONS[j.apply_url], isClosed=j.is_open===false, isUnverified=j.is_open===null;
    const rowClass=isProc?"processed":isClosed?"closed":isUnverified?"unverified":"";
    const locFull=[j.location,j.remote_mode].filter(Boolean).join(" · ");
    const closedTag=isClosed?\`<span class="closed-badge">CERRADA</span>\`:"";
    const unverTag=isUnverified?\`<span class="unverified-badge" title="CivicJobs: no verificable automáticamente — abrir y confirmar">⚠ Sin verificar</span>\`:"";
    const u=esc(j.apply_url);
    const jdHtml = j.jd_highlight ? \`<div class="cell-jd">\${highlightKw(j.jd_highlight)}</div>\` : \`<span class="cell-empty">—</span>\`;
    return \`<tr class="\${rowClass}">
      <td><div class="actions-cell">
        <button class="btn-act btn-apply"   title="Aplicar"   onclick="openModal('\${u}','apply')">✓</button>
        <button class="btn-act btn-discard" title="Descartar" onclick="openModal('\${u}','discard')">✕</button>
        <button class="btn-act btn-archive" title="Archivar"  onclick="openModal('\${u}','archive')">⊙</button>
      </div></td>
      <td><span class="cell-run">\${RUN_DATE}</span></td>
      <td class="cell-date">\${fmtDate(j.captured_at)||"—"}</td>
      <td class="cell-date">\${fmtDate(j.posted_at)||"—"}</td>
      <td>\${j.industry?\`<span class="cell-date">\${esc(j.industry)}</span>\`:\`<span class="cell-empty">—</span>\`}</td>
      <td><div class="score-wrap"><div class="score-bar"><div class="score-fill \${scoreColor(j.score)}" style="width:\${j.score}%"></div></div><span class="score-num">\${j.score}</span></div></td>
      <td><span class="badge \${prioClass(j.priority)}">\${esc(j.priority||"—")}</span></td>
      <td><span class="badge \${veredictoClass(j.veredicto)}">\${veredictoLabel(j.veredicto)}</span></td>
      <td><span class="badge \${sourceClass(j.source_id)}">\${sourceLabel(j.source_id)}</span></td>
      <td><div class="cell-org">\${esc(j.organization)}\${closedTag}\${unverTag}</div></td>
      <td><div class="cell-title">\${esc(j.title)}</div></td>
      <td><div class="cell-loc">\${esc(locFull)||"—"}</div></td>
      <td>\${j.compensation?\`<span class="cell-comp">\${esc(j.compensation)}</span>\`:\`<span class="cell-empty">—</span>\`}</td>
      <td><div class="cell-why">\${esc(j.why_now)||\`<span class="cell-empty">—</span>\`}</div></td>
      <td><div class="cell-val">\${esc(j.open_questions)||\`<span class="cell-empty">—</span>\`}</div></td>
      <td>\${jdHtml}</td>
      <td>\${j.apply_url?\`<a class="link-btn\${isClosed?" closed":""}" href="\${u}" \${isClosed?"":'target="_blank" rel="noopener"'}>\${isClosed?"Cerrada":"Ver →"}</a>\`:\`<span class="cell-empty">—</span>\`}</td>
    </tr>\`;
  }).join("");
}

function applyFilters(){
  ACTIONS=loadActions();
  const q=document.getElementById("search").value.toLowerCase();
  const fv=document.getElementById("fil-veredicto").value;
  const fp=document.getElementById("fil-prioridad").value;
  const fs=document.getElementById("fil-source").value;
  const fm=document.getElementById("fil-modalidad").value;

  filteredList=JOBS.filter(j=>{
    if(q&&!j.title.toLowerCase().includes(q)&&!j.organization.toLowerCase().includes(q))return false;
    if(fv&&j.veredicto!==fv)return false;
    if(fp&&j.priority!==fp)return false;
    if(fs&&j.source_name!==fs)return false;
    if(fm&&!j.remote_mode.toLowerCase().includes(fm.toLowerCase()))return false;
    if(hideClosed&&j.is_open===false)return false;
    if(hideUnverified&&j.is_open===null)return false;
    if(hideProc&&ACTIONS[j.apply_url])return false;
    return true;
  }).sort((a,b)=>{
    // Secondary sort: verified open first, unverified second, closed last
    const openRank = x => x.is_open===true?0:x.is_open===null?1:2;
    const av=sortValue(a,sortCol),bv=sortValue(b,sortCol);
    const primary = av<bv?sortDir:av>bv?-sortDir:0;
    if(sortCol==="score" && primary===0) return openRank(a)-openRank(b);
    return primary || openRank(a)-openRank(b);
  });

  currentPage=1;
  renderActivasPage();
  updateStats();
}

function clearFilters(){
  document.getElementById("search").value="";
  ["fil-veredicto","fil-prioridad","fil-source","fil-modalidad"].forEach(id=>document.getElementById(id).value="");
  applyFilters();
}

// ── Sort headers ──────────────────────────────────────────────────────────────
document.querySelectorAll("thead th[data-col]").forEach(th=>{
  th.addEventListener("click",()=>{
    const col=th.dataset.col;
    if(sortCol===col){sortDir*=-1;}else{sortCol=col;sortDir=col==="score"?-1:1;}
    document.querySelectorAll("thead th").forEach(h=>h.classList.remove("sorted-asc","sorted-desc"));
    th.classList.add(sortDir===1?"sorted-asc":"sorted-desc");
    applyFilters();
  });
});
["search","fil-veredicto","fil-prioridad","fil-source","fil-modalidad"].forEach(id=>{
  const el=document.getElementById(id);
  el.addEventListener("input",applyFilters);
  el.addEventListener("change",applyFilters);
});
document.getElementById("pg-input").addEventListener("keydown",e=>{if(e.key==="Enter")goToPage(e.target.value);});

// ── Init tab display ──────────────────────────────────────────────────────────
TAB_IDS.forEach(t=>{
  const el=document.getElementById("tab-"+t);
  if(el&&t!=="activas"){ el.classList.add("hidden"); el.style.display="none"; }
  if(el&&t==="activas"){ el.style.display="flex"; el.style.flexDirection="column"; }
});

// ── Init ──────────────────────────────────────────────────────────────────────
renderRoles();
updateStats();
applyFilters();
</script>
</body>
</html>`;
}

// ── Highlight extractor (Node.js side) ───────────────────────────────────────
function extractHighlight(job) {
  // 1. jd_raw — best: actual fetched job description text
  if (job.jd_raw && job.jd_raw.length > 40) {
    const clean = job.jd_raw
      .replace(/\s+/g, " ")
      .replace(/^(\s*job description\s*)+/gi, "")
      .trim();
    return clean.slice(0, 250) + (clean.length > 250 ? "…" : "");
  }
  // 2. description_snippet — useful for Adzuna, skip bc-gov title/date format
  if (job.description_snippet) {
    const snip = job.description_snippet.replace(/\n/g, " ").trim();
    // bc-gov snippet is just "Title\nR# XXXXXX\nLocation\nPosted…" — skip it
    if (!snip.match(/R#\s*\d+|Posted [A-Z][a-z]+ \d+, \d{4}/)) {
      return snip.slice(0, 250) + (snip.length > 250 ? "…" : "");
    }
  }
  // 3. jd_summary.what_the_role_does stripped of URL filler
  if (job.jd_summary && typeof job.jd_summary === "object") {
    const what = (job.jd_summary.what_the_role_does || "")
      .replace(/Descripción completa disponible en:\S*/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (what.length > 20) return what.slice(0, 250) + (what.length > 250 ? "…" : "");
  }
  return "";
}

// ── Main ─────────────────────────────────────────────────────────────────────
const scoredPath = path.join(repoRoot, "tmp/jobops-pipeline/latest-scored.json");
if (!fs.existsSync(scoredPath)) {
  console.error("[dashboard] latest-scored.json not found — run jobops:full first");
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(scoredPath, "utf8"));
const jobs = (data.jobs || []).map(j => ({
  ...j,
  jd_highlight: extractHighlight(j),
  // strip heavy fields not needed in browser
  jd_raw: undefined,
}));
const meta = {
  generated_at: new Date().toISOString(),
  job_count: jobs.length,
  source: data.source || "multi-source",
};
const html = buildDashboard(jobs, meta);
const outPath = path.join(repoRoot, "tmp/jobops-pipeline/dashboard.html");
fs.writeFileSync(outPath, html, "utf8");
console.error(`[dashboard] ${jobs.length} jobs → ${outPath}`);
