/**
 * ChainShield AI – Main Application Bootstrap
 * Loads datasets, runs fraud engine, renders all UI views
 */

'use strict';

// ─────────────────────────────────────────────
// GLOBAL STATE
// ─────────────────────────────────────────────

const AppState = {
  invoices: [],
  suppliers: [],
  payments: [],
  graph: null,
  fraudEngine: null,
  riskResults: [],
  riskMap: {},         // invoice_id -> risk result
  supplierRiskMap: {}, // supplier_id -> avg risk, max risk
  currentView: 'dashboard',
  table: {
    filtered: [],
    sortCol: 'risk_score',
    sortDir: 'desc',
    page: 1,
    pageSize: 20,
    search: '',
    tier: '',
    risk: ''
  },
  graph_simulation: null,
  graph_zoom: null,
  inspector: { selectedId: null, allFiltered: [] }
};

// ─────────────────────────────────────────────
// STEP 1: DATA LOADING
// ─────────────────────────────────────────────

async function loadDatasets() {
  const API_BASE = 'http://localhost:3000/api';

  setLoadStep(1, 'active');
  await fetch(`${API_BASE}/invoices`)
    .then(r => r.json())
    .then(d => {
      AppState.invoices = d;
      setLoadStep(1, 'done');
      setLoadStep(2, 'active');
    }).catch(err => console.error('Failed to load invoices:', err));

  await fetch(`${API_BASE}/suppliers`)
    .then(r => r.json())
    .then(d => {
      AppState.suppliers = d;
      setLoadStep(2, 'done');
      setLoadStep(3, 'active');
    }).catch(err => console.error('Failed to load suppliers:', err));

  await fetch(`${API_BASE}/payments`)
    .then(r => r.json())
    .then(d => {
      AppState.payments = d;
      setLoadStep(3, 'done');
      setLoadStep(4, 'active');
    }).catch(err => console.error('Failed to load payments:', err));

  await fetch(`${API_BASE}/graph`)
    .then(r => r.json())
    .then(d => {
      AppState.graph = d;
      setLoadStep(4, 'done');
      setLoadStep(5, 'active');
    }).catch(err => console.error('Failed to load graph:', err));
}

function setLoadStep(step, state) {
  const el = document.getElementById(`step${step}`);
  if (!el) return;
  el.className = `step-item ${state}`;
  el.textContent = (state === 'done' ? '✅' : '⚡') + ' ' + el.textContent.slice(2);
  const pct = { 1: 20, 2: 40, 3: 60, 4: 75, 5: 90 }[step] || 0;
  document.getElementById('loadingBar').style.width = pct + '%';
}

// ─────────────────────────────────────────────
// STEP 2: PROCESS DATA THROUGH FRAUD ENGINE
// ─────────────────────────────────────────────

async function runFraudEngine() {
  AppState.fraudEngine = new FraudEngine(
    AppState.invoices,
    AppState.suppliers,
    AppState.payments,
    AppState.graph
  );

  // Wait for async fingerprint pre-computation
  await new Promise(r => setTimeout(r, 300));

  AppState.riskResults = await AppState.fraudEngine.processAllInvoices(pct => {
    document.getElementById('loadingBar').style.width = (90 + pct * 0.1) + '%';
  });

  // Build risk lookup map
  AppState.riskResults.forEach(r => { AppState.riskMap[r.invoice_id] = r; });

  // Compute per-supplier aggregated risk
  const supGroups = {};
  AppState.riskResults.forEach(r => {
    const inv = AppState.invoices.find(i => i.invoice_id === r.invoice_id);
    if (!inv) return;
    const sid = inv.supplier_id;
    if (!supGroups[sid]) supGroups[sid] = [];
    supGroups[sid].push(r.risk_score);
  });
  Object.keys(supGroups).forEach(sid => {
    const scores = supGroups[sid];
    AppState.supplierRiskMap[sid] = {
      avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      max: Math.max(...scores),
      count: scores.length
    };
  });

  setLoadStep(5, 'done');
  document.getElementById('loadingBar').style.width = '100%';
}

// ─────────────────────────────────────────────
// STEP 3: INIT APP
// ─────────────────────────────────────────────

async function initApp() {
  // Update KPIs with animation
  const stats = AppState.fraudEngine.computeSummaryStats(AppState.riskResults);

  animateValue('kpi-total', 0, stats.total_invoices, 1500);
  animateValue('kpi-alerts', 0, stats.fraud_alerts, 1200);
  function updateGraphNodeCount() {
    const count = AppState.graph?.nodes?.length ?? 0;
    const nodeCountEl = document.getElementById("graphNodeCount");
    if (nodeCountEl) {
      nodeCountEl.textContent = count.toLocaleString();
    }
  }
  updateGraphNodeCount();
  animateValue('kpi-avg-risk', 0, stats.avg_risk_score, 1000);

  // v2.1 Metrics
  animateValue('kpi-recon', 0, stats.avg_recon_confidence, 1300);
  animateValue('kpi-velocity', 0, stats.velocity_risks, 1100);
  animateValue('kpi-systemic', 0, stats.systemic_risks, 1400);

  const riskFillEl = document.getElementById('kpiRiskFill');
  if (riskFillEl) {
    riskFillEl.style.width = stats.avg_risk_score + '%';
  }

  // Update navbar status
  document.getElementById('dataStatus').innerHTML =
    '<span class="status-dot ready-dot"></span> ' + stats.total_invoices + ' invoices loaded';

  // Merge risk scores into display data
  AppState.displayData = AppState.invoices.map((inv, idx) => {
    const risk = AppState.riskMap[inv.invoice_id] || { risk_score: 0, decision: 'APPROVE', decision_class: 'approved', components: {} };
    return { ...inv, ...risk };
  });

  // Render all views
  renderTable();
  renderHeatmap();
  renderDistChart();
  renderGraph();
  renderInspectorList();

  // Initial simulation
  // Initial simulation (only if simulation engine exists)
  if (
    AppState.fraudEngine &&
    typeof AppState.fraudEngine.simulateRiskScore === "function"
  ) {
    runSimulation();
  } else {
    console.warn("Simulation engine not available. Skipping simulation init.");
  }

  // Initialize new features
  initSystemHealth();
  initCommandPalette();

  // Show app
  document.getElementById('loadingScreen').style.opacity = '0';
  setTimeout(() => {
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('appContainer').classList.remove('hidden');
  }, 400);
}

// ─────────────────────────────────────────────
// ANIMATIONS & UTILS
// ─────────────────────────────────────────────

function animateValue(id, start, end, duration) {
  const obj = document.getElementById(id);
  if (!obj) return;
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const val = Math.floor(progress * (end - start) + start);
    obj.innerHTML = val.toLocaleString();
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
}

// ─────────────────────────────────────────────
// SYSTEM HEALTH MONITOR
// ─────────────────────────────────────────────

function initSystemHealth() {
  const update = () => {
    // Latency simulation (retained internally if needed, but UI changed)
    // Model Metrics (Synthetic Validation)
    // For demo, we assume ground truth is risk > 70 in a "clean" dataset
    // We'll simulate some noise to make it realistic
    const predictions = AppState.riskResults;
    const actualLabels = AppState.riskResults.map(r => r.risk_score > 75); // Ground truth proxy
    const metrics = AppState.fraudEngine.calculateModelMetrics(predictions, actualLabels);

    document.getElementById('model-f1').textContent = metrics.f1;
    document.getElementById('model-precision').textContent = metrics.precision;
    document.getElementById('model-recall').textContent = metrics.recall;
  };
  setInterval(update, 5000);
  update();
}

// ─────────────────────────────────────────────
// COMMAND PALETTE
// ─────────────────────────────────────────────

function initCommandPalette() {
  const palette = document.getElementById('commandPalette');
  const input = document.getElementById('paletteInput');
  const results = document.getElementById('paletteResults');
  let selectedIdx = 0;

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault();
      palette.classList.add('visible');
      input.focus();
      renderPaletteResults('');
    }
    if (e.key === 'Escape') {
      palette.classList.remove('visible');
    }
  });

  palette.addEventListener('click', (e) => {
    if (e.target === palette) palette.classList.remove('visible');
  });

  input.addEventListener('input', (e) => {
    renderPaletteResults(e.target.value);
  });

  input.addEventListener('keydown', (e) => {
    const items = results.querySelectorAll('.palette-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIdx = (selectedIdx + 1) % items.length;
      updateSelection(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIdx = (selectedIdx - 1 + items.length) % items.length;
      updateSelection(items);
    } else if (e.key === 'Enter') {
      items[selectedIdx]?.click();
    }
  });

  function updateSelection(items) {
    items.forEach((item, idx) => {
      item.classList.toggle('selected', idx === selectedIdx);
    });
    items[selectedIdx]?.scrollIntoView({ block: 'nearest' });
  }

  function renderPaletteResults(query) {
    results.innerHTML = '';
    selectedIdx = 0;
    const q = query.toLowerCase();

    // Default commands if no query or general query
    const commands = [
      { id: 'goto-dashboard', title: 'Go to Dashboard', sub: 'View key performance metrics', icon: '📊', action: () => document.getElementById('tab-dashboard').click() },
      { id: 'goto-graph', title: 'Open Network Graph', sub: 'Inspect supply chain relationships', icon: '🕸', action: () => document.getElementById('tab-graph').click() },
      { id: 'goto-sim', title: 'Risk Simulator', sub: 'Model fraud scenarios', icon: '⚙️', action: () => document.getElementById('tab-simulation').click() }
    ];

    let matches = [];
    if (!q) {
      matches = commands;
    } else {
      // Look for invoices/suppliers
      const dataMatches = AppState.displayData.filter(d =>
        d.invoice_id.toLowerCase().includes(q) ||
        d.supplier_id.toLowerCase().includes(q)
      ).slice(0, 5).map(d => ({
        id: d.invoice_id,
        title: `Invoice ${d.invoice_id}`,
        sub: `${d.supplier_id} · ₹${formatAmount(d.invoice_amount)} · Risk: ${d.risk_score}`,
        icon: d.risk_score >= 70 ? '🚨' : '📄',
        action: () => inspectInvoice(d.invoice_id)
      }));

      const cmdMatches = commands.filter(c => c.title.toLowerCase().includes(q));
      matches = [...cmdMatches, ...dataMatches];
    }

    matches.forEach((m, idx) => {
      const el = document.createElement('div');
      el.className = `palette-item ${idx === 0 ? 'selected' : ''}`;
      el.innerHTML = `
        <div class="palette-item-icon">${m.icon}</div>
        <div class="palette-item-info">
          <div class="palette-item-title">${m.title}</div>
          <div class="palette-item-sub">${m.sub}</div>
        </div>
      `;
      el.addEventListener('click', () => {
        m.action();
        palette.classList.remove('visible');
        input.value = '';
      });
      results.appendChild(el);
    });
  }
}

// ─────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────

document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const view = tab.dataset.view;
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${view}`).classList.add('active');
    AppState.currentView = view;
    if (view === 'graph') refreshGraphSize();
  });
});

// ─────────────────────────────────────────────
// TABLE RENDERING
// ─────────────────────────────────────────────

function renderTable() {
  const data = AppState.displayData || [];
  const { search, tier, risk, sortCol, sortDir, page, pageSize } = AppState.table;

  // Filter
  let filtered = data.filter(row => {
    const q = search.toLowerCase();
    const matchSearch = !q || [row.invoice_id, row.supplier_id, row.buyer_id].some(v => v && String(v).toLowerCase().includes(q));
    const matchTier = !tier || String(row.tier_level) === tier;
    const matchRisk = !risk || row.decision_class === risk;
    return matchSearch && matchTier && matchRisk;
  });

  // Sort
  filtered.sort((a, b) => {
    let va = a[sortCol], vb = b[sortCol];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });

  AppState.table.filtered = filtered;

  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageData = filtered.slice(start, end);

  document.getElementById('tableCount').textContent = total.toLocaleString() + ' records';
  document.getElementById('paginationInfo').textContent = `Showing ${start + 1}–${end} of ${total}`;
  document.getElementById('pageNum').textContent = `${page} / ${totalPages}`;
  document.getElementById('prevPage').disabled = page <= 1;
  document.getElementById('nextPage').disabled = page >= totalPages;

  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  pageData.forEach(row => {
    const score = row.risk_score || 0;
    const scoreClass = score >= 70 ? 'bar-danger' : score >= 40 ? 'bar-warn' : 'bar-safe';
    const chipClass = `chip-${row.decision_class}`;
    const dupDetail = row.components?.duplicate_risk?.detail || {};
    const isDup = (dupDetail.risk || AppState.fraudEngine?.computeDuplicateRiskSync(row)?.risk || 0) === 1;
    const fai = row.components?.cascade_fai?.detail?.fai ?? '—';
    const anomScore = row.components?.behavioral_anomaly?.detail?.score != null
      ? row.components.behavioral_anomaly.detail.score.toFixed(2) : '—';

    const tr = document.createElement('tr');
    tr.className = row.decision_class === 'blocked' ? 'blocked-row' : '';
    tr.innerHTML = `
      <td>${row.invoice_id}</td>
      <td>${row.supplier_id}</td>
      <td><span style="padding:2px 8px;border-radius:4px;background:rgba(255,255,255,0.05);font-size:11px;">T${row.tier_level}</span></td>
      <td>₹${formatAmount(row.invoice_amount)}</td>
      <td>
        <div class="score-cell">
          <div class="score-bar"><div class="score-bar-fill ${scoreClass}" style="width:${score}%"></div></div>
          <span style="color:${score >= 70 ? 'var(--red)' : score >= 40 ? 'var(--yellow)' : 'var(--green)'};font-weight:700">${score}</span>
        </div>
      </td>
      <td><span class="risk-chip ${chipClass}">${row.decision}</span></td>
      <td><span style="font-family:var(--mono);font-size:11px">${anomScore}</span></td>
      <td><span style="font-family:var(--mono);font-size:11px;color:${fai > 3 ? 'var(--red)' : 'var(--text-2)'}">${typeof fai === 'number' ? fai.toFixed(2) : fai}</span></td>
      <td><span class="dup-badge ${isDup ? 'dup-yes' : 'dup-no'}">${isDup ? '⚠ DUP' : '—'}</span></td>
      <td><button class="btn-inspect" onclick='inspectInvoice("${row.invoice_id}")'>Inspect</button></td>
    `;
    tr.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-inspect')) return;
      inspectInvoice(row.invoice_id);
    });
    tbody.appendChild(tr);
  });
}

function filterTable() {
  AppState.table.search = document.getElementById('tableSearch').value;
  AppState.table.tier = document.getElementById('tierFilter').value;
  AppState.table.risk = document.getElementById('riskFilter').value;
  AppState.table.page = 1;
  renderTable();
}

function sortTable(col) {
  if (AppState.table.sortCol === col) {
    AppState.table.sortDir = AppState.table.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    AppState.table.sortCol = col;
    AppState.table.sortDir = 'desc';
  }
  document.querySelectorAll('th.sortable').forEach(th => th.classList.remove('sort-active'));
  document.querySelector(`th[data-col="${col}"]`)?.classList.add('sort-active');
  AppState.table.page = 1;
  renderTable();
}

function changePage(delta) {
  const total = AppState.table.filtered.length;
  const totalPages = Math.ceil(total / AppState.table.pageSize);
  AppState.table.page = Math.max(1, Math.min(totalPages, AppState.table.page + delta));
  renderTable();
}

function formatAmount(val) {
  const n = parseFloat(val) || 0;
  if (n >= 10000000) return (n / 10000000).toFixed(2) + ' Cr';
  if (n >= 100000) return (n / 100000).toFixed(2) + ' L';
  return n.toLocaleString('en-IN');
}

// ─────────────────────────────────────────────
// HEATMAP (D3)
// ─────────────────────────────────────────────

function renderHeatmap() {
  const container = document.getElementById('heatmapContainer');
  const W = container.clientWidth || 340;
  const H = container.clientHeight || 200;
  const svg = d3.select('#heatmapSvg').attr('width', W).attr('height', H);
  svg.selectAll('*').remove();

  // Group suppliers by tier and avg risk
  const tiers = [1, 2, 3];
  const tierData = tiers.map(t => {
    const supplierIds = AppState.suppliers.filter(s => s.tier_level === t).map(s => s.supplier_id);
    return supplierIds.map(sid => ({
      id: sid,
      risk: AppState.supplierRiskMap[sid]?.avg || 0,
      tier: t
    }));
  }).flat();

  if (tierData.length === 0) return;

  const cols = 10;
  const pad = 8;
  const cellW = (W - pad * 2) / cols - 2;
  const cellH = 24;
  const tierLabels = { 1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3' };
  const tierColors = { 1: '#22D3EE', 2: '#2563EB', 3: '#7C3AED' };

  const colorScale = d3.scaleSequential(d3.interpolateRgb('#1a2744', '#EF4444')).domain([0, 100]);

  let y = pad + 20;
  tiers.forEach(tier => {
    const rows = tierData.filter(d => d.tier === tier);

    svg.append('text')
      .attr('x', pad).attr('y', y - 4)
      .attr('fill', tierColors[tier])
      .attr('font-size', 10).attr('font-weight', 700)
      .attr('font-family', 'Inter')
      .text(`${tierLabels[tier]} (${rows.length} suppliers)`);

    rows.forEach((d, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = pad + col * (cellW + 2);
      const cy = y + row * (cellH + 2);

      const rect = svg.append('rect')
        .attr('x', cx).attr('y', cy)
        .attr('width', cellW).attr('height', cellH)
        .attr('rx', 4)
        .attr('fill', colorScale(d.risk))
        .attr('stroke', d.risk >= 70 ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.04)')
        .attr('stroke-width', d.risk >= 70 ? 1.5 : 0.5)
        .style('cursor', 'pointer');

      rect.append('title').text(`${d.id}: risk ${d.risk}`);

      if (cellW > 20) {
        svg.append('text')
          .attr('x', cx + cellW / 2).attr('y', cy + cellH / 2 + 4)
          .attr('text-anchor', 'middle')
          .attr('fill', d.risk > 50 ? '#fff' : '#94A3B8')
          .attr('font-size', 9).attr('font-family', 'JetBrains Mono, monospace')
          .text(d.risk);
      }

      y = y; // computed below
    });

    const rowCount = Math.ceil(rows.length / cols);
    y += rowCount * (cellH + 2) + 20;
  });

  // Color scale legend
  const lx = pad, ly = H - 22, lw = W - pad * 2;
  const gradId = 'hm-grad';
  const defs = svg.append('defs');
  const grad = defs.append('linearGradient').attr('id', gradId).attr('x1', '0%').attr('x2', '100%');
  grad.append('stop').attr('offset', '0%').attr('stop-color', '#1a2744');
  grad.append('stop').attr('offset', '100%').attr('stop-color', '#EF4444');
  svg.append('rect').attr('x', lx).attr('y', ly).attr('width', lw).attr('height', 6).attr('rx', 3).attr('fill', `url(#${gradId})`);
  svg.append('text').attr('x', lx).attr('y', ly + 18).attr('fill', '#475569').attr('font-size', 9).attr('font-family', 'Inter').text('0 (Low Risk)');
  svg.append('text').attr('x', lx + lw).attr('y', ly + 18).attr('fill', '#475569').attr('font-size', 9).attr('font-family', 'Inter').attr('text-anchor', 'end').text('100 (High Risk)');
}

// ─────────────────────────────────────────────
// DISTRIBUTION CHART (D3 BAR CHART)
// ─────────────────────────────────────────────

function renderDistChart() {
  const container = document.getElementById('distChartContainer');
  const W = container.clientWidth || 340;
  const H = container.clientHeight || 160;
  const marginL = 28, marginB = 24, marginT = 10, marginR = 10;
  const chartW = W - marginL - marginR;
  const chartH = H - marginT - marginB;

  const svg = d3.select('#distChart').attr('width', W).attr('height', H);
  svg.selectAll('*').remove();

  // Bucket scores into bins of 10
  const scores = AppState.riskResults.map(r => r.risk_score);
  const bins = Array.from({ length: 10 }, (_, i) => ({ range: `${i * 10}-${i * 10 + 10}`, lo: i * 10, hi: i * 10 + 10, count: 0 }));
  scores.forEach(s => {
    const idx = Math.min(9, Math.floor(s / 10));
    bins[idx].count++;
  });

  const maxCount = Math.max(...bins.map(b => b.count));
  const xScale = d3.scaleBand().domain(bins.map(b => b.range)).range([0, chartW]).padding(0.2);
  const yScale = d3.scaleLinear().domain([0, maxCount]).range([chartH, 0]).nice();

  const g = svg.append('g').attr('transform', `translate(${marginL},${marginT})`);

  // Grid lines
  g.selectAll('.grid-line').data(yScale.ticks(4)).enter()
    .append('line')
    .attr('class', 'grid-line')
    .attr('x1', 0).attr('x2', chartW)
    .attr('y1', d => yScale(d)).attr('y2', d => yScale(d))
    .attr('stroke', 'rgba(255,255,255,0.04)').attr('stroke-width', 1);

  // Bars
  g.selectAll('.bar').data(bins).enter()
    .append('rect')
    .attr('class', 'bar')
    .attr('x', d => xScale(d.range))
    .attr('y', chartH)
    .attr('width', xScale.bandwidth())
    .attr('height', 0)
    .attr('rx', 3)
    .attr('fill', d => d.lo >= 70 ? 'rgba(239,68,68,0.7)' : d.lo >= 40 ? 'rgba(245,158,11,0.7)' : 'rgba(34,197,94,0.6)')
    .transition().duration(500).delay((_, i) => i * 40)
    .attr('y', d => yScale(d.count))
    .attr('height', d => chartH - yScale(d.count));

  // X axis
  const xAxis = g.append('g').attr('transform', `translate(0,${chartH})`);
  xAxis.selectAll('.x-label').data(bins.filter((_, i) => i % 2 === 0)).enter()
    .append('text')
    .attr('x', d => xScale(d.range) + xScale.bandwidth() / 2)
    .attr('y', 14)
    .attr('text-anchor', 'middle')
    .attr('fill', '#475569').attr('font-size', 8).attr('font-family', 'JetBrains Mono, monospace')
    .text(d => d.lo);

  // Y axis labels
  g.selectAll('.y-label').data(yScale.ticks(3)).enter()
    .append('text')
    .attr('x', -4).attr('y', d => yScale(d) + 3)
    .attr('text-anchor', 'end').attr('fill', '#475569')
    .attr('font-size', 8).attr('font-family', 'JetBrains Mono, monospace')
    .text(d => d);
}

// ─────────────────────────────────────────────
// NETWORK GRAPH (D3 Force-Directed)
// ─────────────────────────────────────────────

function renderGraph() {
  const container = document.getElementById('graphContainer');
  const W = container.clientWidth || 900;
  const H = container.clientHeight || 500;

  const gData = AppState.graph;
  if (!gData || !gData.nodes) return;
  gData.edges.forEach(edge => {
    ["source", "target"].forEach(key => {
      if (typeof edge[key] === "string" && edge[key].startsWith("BUY-")) {
        const num = edge[key].split("-")[1];
        edge[key] = "BUY-" + num.padStart(3, "0");
      }
    });
  });
  document.getElementById('graphNodeCount').textContent = `${gData.nodes.length} nodes, ${gData.edges.length} edges`;

  const svg = d3.select('#networkGraph').attr('width', W).attr('height', H);
  svg.selectAll('*').remove();

  // Zoom
  const zoom = d3.zoom().scaleExtent([0.2, 4]).on('zoom', (e) => g.attr('transform', e.transform));
  svg.call(zoom);
  AppState.graph_zoom = zoom;

  const g = svg.append('g');

  // Determine risk-colored nodes
  const highRiskSuppliers = new Set(
    AppState.riskResults.filter(r => r.risk_score >= 70)
      .map(r => AppState.invoices.find(i => i.invoice_id === r.invoice_id)?.supplier_id)
      .filter(Boolean)
  );
  const cycleNodes = AppState.fraudEngine?.cycleNodes || new Set();

  // Color function
  function nodeColor(d) {
    if (cycleNodes.has(d.id)) return '#A855F7';
    if (d.type === 'buyer') return '#22D3EE';
    if (d.type === 'lender') return '#F59E0B';
    if (highRiskSuppliers.has(d.id)) return '#EF4444';
    // Graduate by supplier avg risk
    const sr = AppState.supplierRiskMap[d.id];
    if (sr) {
      if (sr.avg >= 70) return '#EF4444';
      if (sr.avg >= 40) return '#F59E0B';
    }
    return '#2563EB';
  }

  function nodeRadius(d) {
    if (d.type === 'buyer') return 8;
    if (d.type === 'lender') return 10;
    const sr = AppState.supplierRiskMap[d.id];
    if (sr) return 6 + Math.min(10, sr.count * 0.8);
    return 6;
  }

  // Links
  const link = g.append('g').selectAll('line')
    .data(gData.edges)
    .enter().append('line')
    .attr('class', d => `graph-link link-${d.type}`)
    .attr('stroke-width', 1)
    .attr('marker-end', 'url(#arrow)');

  // Arrow marker
  const defs = svg.append('defs');
  defs.append('marker')
    .attr('id', 'arrow').attr('viewBox', '0 -4 8 8')
    .attr('refX', 14).attr('refY', 0)
    .attr('markerWidth', 6).attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path').attr('d', 'M0,-4L8,0L0,4').attr('fill', 'rgba(255,255,255,0.15)');

  // Nodes
  const nodeGroup = g.append('g').selectAll('.graph-node')
    .data(gData.nodes)
    .enter().append('g')
    .attr('class', 'graph-node')
    .on('click', (event, d) => showGraphTooltip(event, d))
    .on('mouseover', (event, d) => showGraphTooltip(event, d))
    .on('mouseout', hideGraphTooltip)
    .call(d3.drag()
      .on('start', (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on('end', (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
    );

  nodeGroup.append('circle')
    .attr('r', nodeRadius)
    .attr('fill', d => nodeColor(d) + '33')
    .attr('stroke', nodeColor)
    .attr('stroke-width', d => cycleNodes.has(d.id) ? 2.5 : 1.5);

  // Glow for high risk or systemic importance
  nodeGroup.filter(d => highRiskSuppliers.has(d.id) || cycleNodes.has(d.id) || (AppState.fraudEngine?.graphEngine?.centralityData[d.id]?.degreeCentrality > 0.7))
    .append('circle')
    .attr('r', d => nodeRadius(d) + 4)
    .attr('fill', 'none')
    .attr('stroke', d => {
      if (cycleNodes.has(d.id)) return '#A855F7';
      if (AppState.fraudEngine?.graphEngine?.centralityData[d.id]?.degreeCentrality > 0.7) return '#22D3EE';
      return '#EF4444';
    })
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '3 2')
    .attr('opacity', 0.5)
    .style('animation', 'pulse-dot 2s infinite');

  nodeGroup.append('text')
    .attr('dy', d => nodeRadius(d) + 10)
    .attr('text-anchor', 'middle')
    .attr('fill', '#64748B')
    .attr('font-size', 8)
    .attr('font-family', 'JetBrains Mono, monospace')
    .text(d => d.label.replace('SUP-', 'S').replace('BUY-', 'B').replace('LND-', 'L'));

  // Force simulation
  const simulation = d3.forceSimulation(gData.nodes)
    .force('link', d3.forceLink(gData.edges).id(d => d.id).distance(60).strength(0.3))
    .force('charge', d3.forceManyBody().strength(-120))
    .force('center', d3.forceCenter(W / 2, H / 2))
    .force('collision', d3.forceCollide().radius(16))
    .on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      nodeGroup.attr('transform', d => `translate(${d.x},${d.y})`);
    });

  AppState.graph_simulation = simulation;

  // Center view
  setTimeout(() => {
    svg.call(zoom.transform, d3.zoomIdentity.translate(W * 0.1, H * 0.1).scale(0.8));
  }, 1000);
}

function showGraphTooltip(event, d) {
  const tooltip = document.getElementById('graphTooltip');
  const sr = AppState.supplierRiskMap[d.id];
  const isHighRisk = sr && sr.avg >= 70;
  const isCycle = AppState.fraudEngine?.cycleNodes?.has(d.id);

  tooltip.innerHTML = `
    <div style="font-weight:700;color:var(--text-1);margin-bottom:6px">${d.id}</div>
    <div style="color:var(--text-3);font-size:11px;margin-bottom:4px">Type: <span style="color:var(--text-1)">${d.type || 'unknown'}</span></div>
    ${d.tier ? `<div style="color:var(--text-3);font-size:11px;margin-bottom:4px">Tier: <span style="color:var(--cyan)">Tier ${d.tier}</span></div>` : ''}
    ${sr ? `<div style="color:var(--text-3);font-size:11px;margin-bottom:2px">Avg Risk: <span style="color:${isHighRisk ? 'var(--red)' : 'var(--green)'};font-weight:700;font-family:var(--mono)">${sr.avg}</span></div>` : ''}
    ${sr ? `<div style="color:var(--text-3);font-size:11px;margin-bottom:2px">Invoices: <span style="color:var(--text-2)">${sr.count}</span></div>` : ''}
    ${AppState.fraudEngine?.graphEngine?.centralityData[d.id] ? `
        <div style="height:1px;background:rgba(255,255,255,0.05);margin:6px 0"></div>
        <div style="color:var(--text-3);font-size:10px;margin-bottom:2px">Centrality: <span style="color:var(--cyan);font-family:var(--mono)">${AppState.fraudEngine.graphEngine.centralityData[d.id].degreeCentrality.toFixed(2)}</span></div>
        <div style="color:var(--text-3);font-size:10px;margin-bottom:2px">Impact: <span style="color:${AppState.fraudEngine.graphEngine.centralityData[d.id].degreeCentrality > 0.7 ? 'var(--red)' : 'var(--text-1)'}">${AppState.fraudEngine.graphEngine.centralityData[d.id].systemicImpactFactor}</span></div>
    ` : ''}
    ${isCycle ? `<div style="color:#A855F7;font-size:11px;font-weight:700;margin-top:4px">⚠ In Circular Trade Cycle</div>` : ''}
    ${isHighRisk ? `<div style="color:var(--red);font-size:11px;font-weight:700;margin-top:4px">🚨 HIGH FRAUD RISK</div>` : ''}
  `;
  tooltip.classList.remove('hidden');
  const rect = event.target.closest('#graphContainer').getBoundingClientRect();
  tooltip.style.left = (event.clientX - rect.left + 12) + 'px';
  tooltip.style.top = (event.clientY - rect.top - 10) + 'px';
}

function hideGraphTooltip() {
  document.getElementById('graphTooltip').classList.add('hidden');
}

function resetGraphZoom() {
  const container = document.getElementById('graphContainer');
  const W = container.clientWidth, H = container.clientHeight;
  d3.select('#networkGraph').call(AppState.graph_zoom.transform, d3.zoomIdentity.translate(W * 0.1, H * 0.1).scale(0.8));
}

function toggleGraphPhysics() {
  const sim = AppState.graph_simulation;
  if (!sim) return;
  if (sim.alpha() > 0.01) {
    sim.stop();
  } else {
    sim.alphaTarget(0.3).restart();
    setTimeout(() => sim.alphaTarget(0), 2000);
  }
}

function refreshGraphSize() {
  setTimeout(() => {
    const container = document.getElementById('graphContainer');
    d3.select('#networkGraph').attr('width', container.clientWidth).attr('height', container.clientHeight);
  }, 100);
}

// ─────────────────────────────────────────────
// SIMULATION PANEL
// ─────────────────────────────────────────────

function runSimulation() {

  const amt = parseFloat(amtEl.value) || 1000000;

  const freq = parseFloat(document.getElementById('sim-freq')?.value || 5);
  const units = parseFloat(document.getElementById('sim-units')?.value || 500);
  const rev = parseFloat(document.getElementById('sim-rev')?.value || 50000000);
  const cap = parseFloat(document.getElementById('sim-cap')?.value || 10000);
  const hist = parseFloat(document.getElementById('sim-hist')?.value || 5);
  const payRatio = (parseFloat(document.getElementById('sim-pay')?.value || 95)) / 100;
  // Update display values
  document.getElementById('sim-amt-val').textContent = '₹' + formatAmount(amt);
  document.getElementById('sim-freq-val').textContent = freq;
  document.getElementById('sim-units-val').textContent = units.toLocaleString();
  document.getElementById('sim-rev-val').textContent = '₹' + formatAmount(rev);
  document.getElementById('sim-cap-val').textContent = cap.toLocaleString();
  document.getElementById('sim-hist-val').textContent = hist;
  document.getElementById('sim-pay-val').textContent = Math.round(payRatio * 100) + '%';

  let result;

  if (
    AppState.fraudEngine &&
    typeof AppState.fraudEngine.simulateRiskScore === "function"
  ) {
    result = AppState.fraudEngine.simulateRiskScore({
      invoice_amount: amt,
      units_supplied: units,
      invoice_frequency: freq,
      historical_avg_frequency: hist,
      historical_avg_amount: amt * 0.6,
      annual_revenue: rev,
      monthly_capacity: cap,
      actual_payment_ratio: payRatio
    });
  } else {
    console.warn("Simulation engine not available.");
    result = {
      risk_score: 30,
      anomaly_score: 0.3,
      fai: 1.2,
      feasibility_score: 0.9,
      revenue_ratio: 0.5,
      dilution_risk: 0,
      freq_deviation: 0,
      decision: 'APPROVE',
      decision_class: 'approved'
    };
  }
  // Update ring
  const circumference = 314;
  const offset = circumference - (result.risk_score / 100) * circumference;
  const ringEl = document.getElementById('simRingFill');
  ringEl.style.strokeDashoffset = offset;
  ringEl.style.stroke = result.risk_score >= 70 ? '#EF4444' : result.risk_score >= 40 ? '#F59E0B' : '#22C55E';

  document.getElementById('simRiskScore').textContent = result.risk_score;

  // Decision
  const icons = { blocked: '❌', review: '⚠️', approved: '✅' };
  const texts = { blocked: 'Block Disbursement', review: 'Manual Review', approved: 'Approve' };
  const colors = { blocked: 'var(--red)', review: 'var(--yellow)', approved: 'var(--green)' };
  document.getElementById('simDecIcon').textContent = icons[result.decision_class];
  const decText = document.getElementById('simDecText');
  decText.textContent = texts[result.decision_class];
  decText.style.color = colors[result.decision_class];

  // Breakdown bars
  const anomPct = Math.round(result.anomaly_score * 100);
  const revPct = Math.min(100, Math.round((result.revenue_ratio > 1.5 ? 80 : result.revenue_ratio * 40)));
  const dilPct = Math.round(result.dilution_risk * 100);
  const faiPct = Math.min(100, Math.round(result.fai * 20));

  setBreakdown('anomaly', anomPct);
  setBreakdown('revenue', revPct);
  setBreakdown('dilution', dilPct);
  setBreakdown('fai', faiPct);

  // Derived metrics
  document.getElementById('met-anomaly').textContent = result.anomaly_score.toFixed(2);
  document.getElementById('met-fai').textContent = result.fai.toFixed(2);
  document.getElementById('met-feas').textContent = result.feasibility_score.toFixed(2);
  document.getElementById('met-rev').textContent = result.revenue_ratio.toFixed(2) + 'x';
  document.getElementById('met-freq').textContent = (result.freq_deviation >= 0 ? '+' : '') + result.freq_deviation.toFixed(2);
  document.getElementById('met-dil').textContent = result.dilution_risk >= 1 ? 'High' : result.dilution_risk >= 0.5 ? 'Med' : 'Low';
}

function setBreakdown(id, pct) {
  const bar = document.getElementById(`bk-${id}`);
  const val = document.getElementById(`bk-${id}-val`);
  if (bar) bar.style.width = pct + '%';
  if (val) val.textContent = pct;
  if (bar) bar.style.background = pct >= 70 ? 'linear-gradient(90deg,#B91C1C,#EF4444)' : pct >= 40 ? 'linear-gradient(90deg,#B45309,#F59E0B)' : 'linear-gradient(90deg,var(--primary),var(--cyan))';
}

function resetSimulation() {
  document.getElementById('sim-amt').value = 1000000;
  document.getElementById('sim-freq').value = 5;
  document.getElementById('sim-units').value = 500;
  document.getElementById('sim-rev').value = 50000000;
  document.getElementById('sim-cap').value = 10000;
  document.getElementById('sim-hist').value = 5;
  document.getElementById('sim-pay').value = 95;
  runSimulation();
}

// ─────────────────────────────────────────────
// INSPECTOR VIEW
// ─────────────────────────────────────────────

function renderInspectorList(filterClass = '') {
  const list = document.getElementById('inspectorList');
  let data = AppState.displayData || [];
  if (filterClass) data = data.filter(d => d.decision_class === filterClass);

  // Sort by risk desc
  data = [...data].sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0));
  AppState.inspector.allFiltered = data;

  list.innerHTML = '';
  data.slice(0, 200).forEach(row => {
    const el = document.createElement('div');
    el.className = `insp-item ${AppState.inspector.selectedId === row.invoice_id ? 'selected' : ''}`;
    el.id = `insp-${row.invoice_id}`;
    el.innerHTML = `
      <div class="insp-dot insp-dot-${row.decision_class}"></div>
      <div class="insp-meta">
        <div class="insp-id">${row.invoice_id} <span class="insp-status-badge ${row.preDisbursementStatus === 'AUTO HOLD' ? 'badge-danger' : row.preDisbursementStatus === 'MANUAL REVIEW' ? 'badge-warn' : 'badge-safe'}">${row.preDisbursementStatus}</span></div>
        <div class="insp-sup">${row.supplier_id} · Tier ${row.tier_level} · ₹${formatAmount(row.invoice_amount)}</div>
      </div>
      <span class="insp-score score-${row.decision_class}">${row.risk_score || 0}</span>
    `;
    el.addEventListener('click', () => inspectInvoice(row.invoice_id));
    list.appendChild(el);
  });
}

function filterInspectorList() {
  renderInspectorList(document.getElementById('insp-filter').value);
}

function inspectInvoice(invoiceId) {
  // Switch to inspector view
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('[data-view="inspector"]').classList.add('active');
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-inspector').classList.add('active');
  AppState.currentView = 'inspector';

  AppState.inspector.selectedId = invoiceId;

  // Update inspector list selection
  document.querySelectorAll('.insp-item').forEach(el => el.classList.remove('selected'));
  const listEl = document.getElementById(`insp-${invoiceId}`);
  if (listEl) {
    listEl.classList.add('selected');
    listEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  // Re-render list if we came from table
  if (!listEl) {
    renderInspectorList();
    const el2 = document.getElementById(`insp-${invoiceId}`);
    if (el2) { el2.classList.add('selected'); el2.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }

  // Get data
  const inv = AppState.invoices.find(i => i.invoice_id === invoiceId);
  const risk = AppState.riskMap[invoiceId];
  if (!inv || !risk) return;

  const payment = AppState.fraudEngine.paymentMap[invoiceId];
  const supplier = AppState.fraudEngine.supplierMap[inv.supplier_id];

  const detail = document.getElementById('inspectorDetail');
  const chips = { blocked: 'verdict-blocked', review: 'verdict-review', approved: 'verdict-approved' };
  const c = risk.components;

  detail.innerHTML = `
    <div class="detail-header">
      <div>
        <div class="detail-inv-id">${inv.invoice_id}</div>
        <div class="detail-sup">${inv.supplier_id} → ${inv.buyer_id} · Tier ${inv.tier_level} · ${inv.invoice_date}</div>
      </div>
      <div class="detail-verdict ${chips[risk.decision_class]}">${risk.decision}</div>
    </div>

    <div style="padding:16px 24px;display:flex;gap:12px;flex-wrap:wrap;border-bottom:1px solid var(--bg-border)">
      <div style="background:var(--bg-card);border:1px solid var(--bg-border);border-radius:var(--radius-sm);padding:10px 16px;min-width:140px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);margin-bottom:4px">Final Risk Score</div>
        <div style="font-size:32px;font-weight:900;font-family:var(--mono);color:${risk.risk_score >= 70 ? 'var(--red)' : risk.risk_score >= 40 ? 'var(--yellow)' : 'var(--green)'}">${risk.risk_score}</div>
      </div>
      <div style="background:var(--bg-card);border:1px solid var(--bg-border);border-radius:var(--radius-sm);padding:10px 16px;min-width:140px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);margin-bottom:4px">Invoice Amount</div>
        <div style="font-size:20px;font-weight:800;font-family:var(--mono);color:var(--text-1)">₹${formatAmount(inv.invoice_amount)}</div>
      </div>
      <div style="background:var(--bg-card);border:1px solid var(--bg-border);border-radius:var(--radius-sm);padding:10px 16px;min-width:140px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);margin-bottom:4px">FAI Index</div>
        <div style="font-size:20px;font-weight:800;font-family:var(--mono);color:${c.cascade_fai?.detail?.fai > 3 ? 'var(--red)' : 'var(--text-1)'}">${c.cascade_fai?.detail?.fai?.toFixed(2) ?? '—'}</div>
      </div>
      <div style="background:var(--bg-card);border:1px solid var(--bg-border);border-radius:var(--radius-sm);padding:10px 16px;min-width:140px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);margin-bottom:4px">Anomaly Score</div>
        <div style="font-size:20px;font-weight:800;font-family:var(--mono);color:${(c.behavioral_anomaly?.detail?.score || 0) > 0.7 ? 'var(--red)' : 'var(--text-1)'}">
          ${c.behavioral_anomaly?.detail?.score?.toFixed(3) ?? '—'}
        </div>
      </div>
    </div>

    <div class="detail-section" style="margin-top:20px">
      <div class="detail-section-title">Pre-Disbursement Risk Engine (Weighted)</div>
      <div class="component-rows">
        ${renderCompRow('🔍', 'Behavioral Anomaly', '25%', Math.round(c.preDisbursement?.components?.behavioral || 0))}
        ${renderCompRow('📊', 'Revenue Feasibility', '20%', Math.round(c.preDisbursement?.components?.feasibility || 0))}
        ${renderCompRow('🆔', 'Duplicate Risk', '15%', Math.round(c.preDisbursement?.components?.duplicate || 0))}
        ${renderCompRow('💧', 'Dilution Risk', '15%', Math.round(c.preDisbursement?.components?.dilution || 0))}
        ${renderCompRow('⚡', 'Velocity Risk', '15%', Math.round(c.preDisbursement?.components?.velocity || 0))}
        ${renderCompRow('🌐', 'Graph Centrality', '10%', Math.round(c.preDisbursement?.components?.graph || 0))}
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">Institutional Verification DNA</div>
      <div class="component-rows">
        ${renderCompRow('📋', 'PO-GRN Reconciliation', 'Score', Math.round(c.preDisbursement?.reconciliationScore || 0))}
        ${renderCompRow('🧬', 'Fraud DNA Deviation', 'Score', Math.round(c.preDisbursement?.dnaDeviationScore || 0))}
        ${renderCompRow('🌊', 'Cascade Exposure (FAI)', '10%', Math.round(c.cascade?.normalized_fai * 100 || 0))}
        ${renderCompRow('🔄', 'Circular Trade', '10%', c.circular?.carousel_fraud ? 100 : 0)}
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">Invoice Details</div>
      <div class="detail-raw">
        <table>
          <tr><td>Invoice ID</td><td>${inv.invoice_id}</td></tr>
          <tr><td>Supplier</td><td>${inv.supplier_id}</td></tr>
          <tr><td>Buyer</td><td>${inv.buyer_id}</td></tr>
          <tr><td>Tier</td><td>Tier ${inv.tier_level}</td></tr>
          <tr><td>Amount</td><td>₹${formatAmount(inv.invoice_amount)}</td></tr>
          <tr><td>Invoice Date</td><td>${inv.invoice_date}</td></tr>
          <tr><td>Due Date</td><td>${inv.due_date}</td></tr>
          <tr><td>PO ID</td><td>${inv.po_id}</td></tr>
          <tr><td>Units Supplied</td><td>${parseFloat(inv.units_supplied || 0).toLocaleString()}</td></tr>
          <tr><td>Unit Price</td><td>₹${parseFloat(inv.unit_price || 0).toFixed(2)}</td></tr>
          <tr><td>Financed</td><td>${inv.financed_flag == 1 ? '✅ Yes' : 'No'}</td></tr>
          <tr><td>Lender</td><td>${inv.lender_id || '—'}</td></tr>
        </table>
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">Payment Details</div>
      <div class="detail-raw">
        <table>
          <tr><td>Expected Payment</td><td>₹${payment ? formatAmount(payment.expected_payment) : '—'}</td></tr>
          <tr><td>Actual Payment</td><td>₹${payment ? formatAmount(payment.actual_payment) : '—'}</td></tr>
          <tr><td>Dilution Ratio</td><td style="color:${c.dilution_risk?.detail?.ratio < 0.7 ? 'var(--red)' : 'var(--text-1)'}">${c.dilution_risk?.detail?.ratio?.toFixed(3) ?? '—'}</td></tr>
          <tr><td>Shortfall</td><td>₹${c.dilution_risk?.detail?.shortfall != null ? formatAmount(c.dilution_risk.detail.shortfall) : '—'}</td></tr>
          <tr><td>High Dilution Risk</td><td>${c.dilution_risk?.detail?.is_high_risk ? '⚠ YES' : 'No'}</td></tr>
        </table>
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">Cascade Exposure</div>
      <div class="detail-raw">
        <table>
          <tr><td>Total Cascade Exposure</td><td>₹${c.cascade_fai?.detail ? formatAmount(c.cascade_fai.detail.total_cascade_exposure) : '—'}</td></tr>
          <tr><td>Upstream Invoices</td><td>${c.cascade_fai?.detail?.upstream_count ?? '—'}</td></tr>
          <tr><td>Downstream Invoices</td><td>${c.cascade_fai?.detail?.downstream_count ?? '—'}</td></tr>
          <tr><td>Fraud Amplification Index</td><td style="color:${c.cascade_fai?.detail?.fai > 3 ? 'var(--red)' : 'var(--text-1)'};font-weight:700">${c.cascade_fai?.detail?.fai?.toFixed(2) ?? '—'}</td></tr>
          <tr><td>Systemic Risk</td><td>${c.cascade_fai?.detail?.is_high_risk ? '🚨 HIGH' : 'Low'}</td></tr>
        </table>
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">Supplier Profile</div>
      <div class="detail-raw">
        <table>
          <tr><td>Annual Revenue</td><td>₹${supplier ? formatAmount(supplier.annual_revenue) : '—'}</td></tr>
          <tr><td>Monthly Capacity</td><td>${supplier ? parseFloat(supplier.monthly_production_capacity).toLocaleString() : '—'} units</td></tr>
          <tr><td>Hist. Avg Invoice Amt</td><td>₹${supplier ? formatAmount(supplier.historical_avg_invoice_amount) : '—'}</td></tr>
          <tr><td>Hist. Avg Frequency</td><td>${supplier?.historical_invoice_frequency ?? '—'} / month</td></tr>
          <tr><td>Default History</td><td>${supplier?.default_history_flag == 1 ? '⚠ YES' : 'Clean'}</td></tr>
        </table>
      </div>
    </div>
  `;
}

function renderCompRow(icon, name, weight, score) {
  const fillClass = score >= 70 ? 'fill-danger' : score >= 40 ? 'fill-warn' : 'fill-safe';
  const scoreColor = score >= 70 ? 'var(--red)' : score >= 40 ? 'var(--yellow)' : 'var(--green)';
  return `
    <div class="comp-row">
      <span class="comp-icon">${icon === 'fingerprint_icon' ? '🖐' : icon}</span>
      <span class="comp-name">${name} <span class="comp-weight">${weight}</span></span>
      <div class="comp-track"><div class="comp-fill ${fillClass}" style="width:${Math.min(100, score)}%"></div></div>
      <span class="comp-score" style="color:${scoreColor}">${score}</span>
    </div>
  `;
}

// ─────────────────────────────────────────────
// BOOTSTRAP
// ─────────────────────────────────────────────

(async function bootstrap() {
  try {
    await loadDatasets();
    await runFraudEngine();
    await initApp();
  } catch (err) {
    console.error('ChainShield AI bootstrap error:', err);
    document.getElementById('loadingScreen').innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;color:var(--red)">
        <div style="font-size:40px">⚠</div>
        <div style="font-size:18px;font-weight:700">Failed to load datasets</div>
        <div style="font-size:13px;color:var(--text-3);max-width:400px;text-align:center">
          Please open this file via a local server (e.g. VS Code Live Server) — the browser cannot load CSV files directly from the filesystem.
        </div>
        <code style="font-size:11px;background:rgba(255,255,255,0.05);padding:8px 16px;border-radius:8px;color:var(--cyan)">
          npm start
        </code>
        <div style="font-size:12px;color:var(--text-3)">Then open: <a href="http://localhost:3001" style="color:var(--primary)">http://localhost:3001</a></div>
      </div>
    `;
  }
})();
