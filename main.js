/* ==========================================
   ChainShield AI – Main JavaScript
   All animations, canvas, interactivity
   ========================================== */

// ---- NAVBAR ----
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
});

// ---- HAMBURGER ----
const hamburger = document.getElementById('hamburger');
const navLinks = document.querySelector('.nav-links');
const navCta = document.querySelector('.nav-cta');
hamburger?.addEventListener('click', () => {
  const open = navLinks.style.display === 'flex';
  if (open) {
    navLinks.style.display = '';
    navCta.style.display = '';
  } else {
    navLinks.style.cssText = 'display:flex;flex-direction:column;position:absolute;top:70px;left:0;right:0;background:rgba(10,15,31,0.98);padding:1.5rem 2rem;gap:1.2rem;border-bottom:1px solid rgba(255,255,255,0.08);backdrop-filter:blur(20px);z-index:999';
    navCta.style.cssText = 'display:none';
  }
});

// ---- SCROLL ANIMATIONS (Intersection Observer) ----
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      // Trigger gauge fills when module cards become visible
      if (e.target.classList.contains('module-card')) {
        triggerGauges(e.target);
      }
      // Trigger risk meters when risk engine visible
      if (e.target.classList.contains('risk-dashboard')) {
        triggerRiskMeters();
        animateRiskScore();
      }
      // Trigger arch layers
      if (e.target.classList.contains('arch-diagram')) {
        triggerArchLayers();
      }
      // Trigger counters
      if (e.target.classList.contains('impact-grid')) {
        triggerCounters();
      }
      if (e.target.classList.contains('hero-stats')) {
        triggerHeroCounters();
      }
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.animate-in').forEach(el => observer.observe(el));
document.querySelectorAll('.risk-dashboard, .arch-diagram, .impact-grid, .hero-stats').forEach(el => observer.observe(el));

// ---- HERO CANVAS – Floating Supply Chain Graph ----
const heroCanvas = document.getElementById('heroCanvas');
const ctx = heroCanvas.getContext('2d');

let nodes = [], edges = [], particles = [], animFrame, W, H;
let fraudPulse = 0;

function resize() {
  W = heroCanvas.width = window.innerWidth;
  H = heroCanvas.height = window.innerHeight;
  buildGraph();
}

function buildGraph() {
  nodes = [];
  edges = [];
  particles = [];

  const tiers = [
    { label: 'T3', x: 0.15, y: 0.35, color: '#60a5fa', r: 14, fraud: false },
    { label: 'T3', x: 0.10, y: 0.6, color: '#60a5fa', r: 12, fraud: false },
    { label: 'T3', x: 0.20, y: 0.75, color: '#60a5fa', r: 11, fraud: false },
    { label: 'T2', x: 0.38, y: 0.3, color: '#818cf8', r: 16, fraud: false },
    { label: 'T2', x: 0.35, y: 0.65, color: '#818cf8', r: 15, fraud: true },
    { label: 'T1', x: 0.60, y: 0.35, color: '#22d3ee', r: 18, fraud: false },
    { label: 'T1', x: 0.62, y: 0.68, color: '#22d3ee', r: 16, fraud: false },
    { label: 'BUY', x: 0.84, y: 0.5, color: '#34d399', r: 22, fraud: false },
  ];

  // Add extra ambient nodes
  for (let i = 0; i < 18; i++) {
    nodes.push({
      label: '',
      x: (0.1 + Math.random() * 0.8) * W,
      y: (0.1 + Math.random() * 0.8) * H,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      color: `rgba(${70 + Math.floor(Math.random() * 80)},${130 + Math.floor(Math.random() * 80)},${200 + Math.floor(Math.random() * 55)},0.6)`,
      r: 4 + Math.random() * 6,
      fraud: false,
      ambient: true,
      phase: Math.random() * Math.PI * 2,
    });
  }

  tiers.forEach(t => {
    nodes.unshift({
      ...t,
      x: t.x * W, y: t.y * H,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      phase: Math.random() * Math.PI * 2,
      ambient: false,
    });
  });

  // Edges between tier nodes (indices 0-7)
  const tierEdges = [
    [0,3],[0,4],[1,3],[1,4],[2,4],[3,5],[4,5],[4,6],[5,7],[6,7]
  ];
  tierEdges.forEach(([a,b]) => {
    edges.push({ a, b, fraud: nodes[a].fraud || nodes[b].fraud || (a===4&&b===5) });
  });

  // Spawn particles along edges
  edges.forEach((e, i) => {
    for (let p = 0; p < 2; p++) {
      particles.push({
        edge: i,
        t: Math.random(),
        speed: 0.001 + Math.random() * 0.002,
        size: 2 + Math.random() * 2,
      });
    }
  });
}

function drawHeroCanvas(time) {
  ctx.clearRect(0, 0, W, H);
  fraudPulse = (Math.sin(time * 0.003) + 1) / 2;

  // Draw edges
  edges.forEach(e => {
    const na = nodes[e.a], nb = nodes[e.b];
    if (!na || !nb) return;
    ctx.beginPath();
    ctx.moveTo(na.x, na.y);
    ctx.lineTo(nb.x, nb.y);
    if (e.fraud) {
      ctx.strokeStyle = `rgba(239,68,68,${0.3 + 0.5 * fraudPulse})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
    } else {
      ctx.strokeStyle = 'rgba(37,99,235,0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  });

  // Draw particles
  particles.forEach(p => {
    p.t += p.speed;
    if (p.t > 1) p.t = 0;
    const e = edges[p.edge];
    if (!e) return;
    const na = nodes[e.a], nb = nodes[e.b];
    if (!na || !nb) return;
    const x = na.x + (nb.x - na.x) * p.t;
    const y = na.y + (nb.y - na.y) * p.t;
    ctx.beginPath();
    ctx.arc(x, y, p.size, 0, Math.PI * 2);
    if (e.fraud) {
      ctx.fillStyle = `rgba(239,68,68,${0.5 + 0.5 * fraudPulse})`;
    } else {
      ctx.fillStyle = 'rgba(34,211,238,0.7)';
    }
    ctx.fill();
  });

  // Draw nodes
  nodes.forEach((n, i) => {
    // Float animation
    n.x += n.vx + Math.sin(time * 0.001 + n.phase) * 0.08;
    n.y += n.vy + Math.cos(time * 0.001 + n.phase) * 0.08;
    // Boundary bounce
    if (n.x < n.r || n.x > W - n.r) n.vx *= -1;
    if (n.y < n.r || n.y > H - n.r) n.vy *= -1;
    n.x = Math.max(n.r, Math.min(W - n.r, n.x));
    n.y = Math.max(n.r, Math.min(H - n.r, n.y));

    const glow = n.fraud ? 0.3 + 0.7 * fraudPulse : 0.5;
    const glowColor = n.fraud ? `rgba(239,68,68,${glow})` : n.color;

    if (!n.ambient) {
      // Glow ring
      const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 2.5);
      grad.addColorStop(0, n.fraud ? `rgba(239,68,68,${glow * 0.4})` : 'rgba(37,99,235,0.15)');
      grad.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Node circle
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    ctx.fillStyle = n.ambient
      ? n.color.replace('0.6', '0.25')
      : (n.fraud ? `rgba(239,68,68,${0.2 + 0.3 * fraudPulse})` : 'rgba(37,99,235,0.25)');
    ctx.fill();
    ctx.strokeStyle = n.fraud ? `rgba(239,68,68,${0.5 + 0.5 * fraudPulse})` : glowColor;
    ctx.lineWidth = n.ambient ? 1 : 1.8;
    ctx.stroke();

    // Label for main nodes
    if (!n.ambient && n.label) {
      ctx.fillStyle = n.fraud ? '#fca5a5' : '#e2e8f0';
      ctx.font = `bold ${Math.max(9, n.r * 0.65)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n.label, n.x, n.y);
    }
  });

  animFrame = requestAnimationFrame(drawHeroCanvas);
}

window.addEventListener('resize', resize);
resize();
animFrame = requestAnimationFrame(drawHeroCanvas);


// ---- HERO STAT COUNTERS ----
function triggerHeroCounters() {
  document.querySelectorAll('.stat-value').forEach(el => {
    const target = parseFloat(el.dataset.target);
    const dec = parseInt(el.dataset.decimal || '0');
    animateCounter(el, 0, target, 2000, dec);
  });
}

function animateCounter(el, from, to, duration, decimals = 0) {
  const start = performance.now();
  const diff = to - from;
  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = from + diff * eased;
    el.textContent = value.toFixed(decimals);
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = to.toFixed(decimals);
  }
  requestAnimationFrame(step);
}

// ---- GAUGE BARS ----
function triggerGauges(card) {
  card.querySelectorAll('.gauge-fill').forEach(fill => {
    const target = fill.style.getPropertyValue('--target');
    setTimeout(() => { fill.style.width = target; }, 100);
  });
}

// ---- RISK SCORE ANIMATION ----
function triggerRiskMeters() {
  document.querySelectorAll('.risk-fill').forEach(fill => {
    const w = fill.style.getPropertyValue('--w');
    setTimeout(() => { fill.style.width = w; }, 200);
  });
}
function animateRiskScore() {
  const el = document.getElementById('riskScoreNum');
  if (el) animateCounter(el, 0, 151, 2500, 0);
}

// ---- ARCHITECTURE LAYERS ----
function triggerArchLayers() {
  const layers = document.querySelectorAll('.arch-layer');
  layers.forEach((layer, i) => {
    setTimeout(() => layer.classList.add('arch-visible'), i * 200);
  });
}

// ---- IMPACT COUNTERS ----
function triggerCounters() {
  document.querySelectorAll('.counter').forEach(el => {
    const target = parseFloat(el.dataset.target);
    const dec = parseInt(el.dataset.decimal || '0');
    const suffix = el.dataset.suffix || '';
    animateCounter(el, 0, target, 2000, dec, suffix);
    el.addEventListener('__done', () => { el.textContent = target.toFixed(dec) + suffix; });
    // Override with suffix
    const start = performance.now();
    const diff = target;
    function step(now) {
      const progress = Math.min((now - start) / 2000, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = (diff * eased).toFixed(dec) + suffix;
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target.toFixed(dec) + suffix;
    }
    requestAnimationFrame(step);
  });
}

// ---- PROBLEM SECTION TOGGLE ----
function showTraditional() {
  document.getElementById('traditionalView').classList.add('active');
  document.getElementById('chainshieldView').classList.remove('active');
  document.getElementById('btnTraditional').classList.add('active');
  document.getElementById('btnChainshield').classList.remove('active');
}

function showChainShield() {
  document.getElementById('chainshieldView').classList.add('active');
  document.getElementById('traditionalView').classList.remove('active');
  document.getElementById('btnChainshield').classList.add('active');
  document.getElementById('btnTraditional').classList.remove('active');
}

// ---- MODULE 2: INVOICE FINGERPRINT ----
const FAKE_HASHES = [
  'a3f4e9d1c8b7f6a2e4d5c3b1a0f8e7d6c5b4a3f2e1d0c9b8',
  'b2e5d8c1a4f7e0d3c6b9a2f5e8d1c4b7a0f3e6d9c2b5a8f1',
  '7c3f9a1e5d2b8f4c0e6a2d8b4f0c6e2a8d4b0f6c2e8a4d0',
];

function runFingerprint() {
  const btn = document.getElementById('fingerprintBtn');
  const result = document.getElementById('fingerprintResult');
  const hashEl = document.getElementById('hashDisplay');

  btn.textContent = 'Computing...';
  btn.disabled = true;
  result.classList.remove('show');

  let i = 0;
  hashEl.textContent = '';
  const hash = FAKE_HASHES[0];

  const interval = setInterval(() => {
    const chunk = hash.substring(0, i + 4);
    hashEl.textContent = 'SHA-256: ' + chunk + (i + 4 < hash.length ? '█' : '');
    i += 4;
    if (i >= hash.length) {
      clearInterval(interval);
      hashEl.textContent = 'SHA-256: ' + hash;
      result.classList.add('show');
      btn.textContent = 'Re-Generate Fingerprint';
      btn.disabled = false;
    }
  }, 60);
}

// ---- MODULE 3: CASCADE SIMULATION ----
let cascadeRan = false;
function runCascade() {
  const btn = document.getElementById('cascadeBtn');
  const tiersEl = document.getElementById('cascadeTiers');
  const tier3 = document.getElementById('tier3item');
  const tier2 = document.getElementById('tier2item');
  const tier1 = document.getElementById('tier1item');
  const total = document.getElementById('cascadeTotal');
  const fai = document.getElementById('faiDisplay');

  btn.textContent = 'Simulating...';
  btn.disabled = true;
  tiersEl.classList.add('show');

  // Reset
  [tier3, tier2, tier1].forEach(el => el.classList.remove('in'));
  total.classList.remove('show');
  fai.classList.remove('show');

  setTimeout(() => { tier3.classList.add('in'); }, 200);
  setTimeout(() => { tier2.classList.add('in'); }, 700);
  setTimeout(() => { tier1.classList.add('in'); }, 1200);
  setTimeout(() => { total.classList.add('show'); }, 1800);
  setTimeout(() => {
    fai.classList.add('show');
    btn.textContent = 'Re-Simulate';
    btn.disabled = false;
  }, 2200);
}

// ---- MODULE 4: BEHAVIOR ANOMALY CHART ----
function drawBehaviorChart() {
  const canvas = document.getElementById('behaviorCanvas');
  if (!canvas) return;
  const c = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  c.clearRect(0, 0, W, H);

  // Background grid
  c.strokeStyle = 'rgba(255,255,255,0.04)';
  c.lineWidth = 1;
  for (let y = 0; y < H; y += H / 5) {
    c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
  }

  const months = 10;
  const stepX = W / months;
  // Normal: ~5/month, then spike to 40 in last step
  const data = [4, 6, 5, 4, 7, 5, 6, 4, 5, 40];
  const maxVal = 45;

  // Normal range band
  c.fillStyle = 'rgba(34,197,94,0.06)';
  c.fillRect(0, H - (8 / maxVal) * H, W, (7 / maxVal) * H);

  // Threshold line
  c.strokeStyle = 'rgba(34,197,94,0.35)';
  c.setLineDash([5, 4]);
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(0, H - (8 / maxVal) * H);
  c.lineTo(W, H - (8 / maxVal) * H);
  c.stroke();
  c.setLineDash([]);

  // Gradient fill under chart
  const grad = c.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(37,99,235,0.3)');
  grad.addColorStop(0.7, 'rgba(37,99,235,0.05)');
  grad.addColorStop(1, 'transparent');

  // Spike gradient
  const spikeGrad = c.createLinearGradient(0, 0, 0, H);
  spikeGrad.addColorStop(0, 'rgba(239,68,68,0.5)');
  spikeGrad.addColorStop(1, 'rgba(239,68,68,0.05)');

  // Draw area fill
  c.beginPath();
  c.moveTo(0, H);
  data.forEach((v, i) => {
    const x = i * stepX + stepX / 2;
    const y = H - (v / maxVal) * H * 0.9;
    if (i === 0) c.lineTo(x, y);
    else c.lineTo(x, y);
  });
  c.lineTo(W, H);
  c.closePath();
  // Fill normal vs spike
  c.fillStyle = grad;
  c.fill();

  // Draw line
  c.beginPath();
  data.forEach((v, i) => {
    const x = i * stepX + stepX / 2;
    const y = H - (v / maxVal) * H * 0.9;
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  });
  c.strokeStyle = 'rgba(60,130,246,0.8)';
  c.lineWidth = 2;
  c.stroke();

  // Spike highlight
  const lastX = (months - 1) * stepX + stepX / 2;
  const lastY = H - (data[months - 1] / maxVal) * H * 0.9;
  c.beginPath();
  c.arc(lastX, lastY, 6, 0, Math.PI * 2);
  c.fillStyle = '#ef4444';
  c.fill();
  c.strokeStyle = 'rgba(239,68,68,0.5)';
  c.lineWidth = 3;
  c.stroke();

  // Label
  c.fillStyle = '#fca5a5';
  c.font = 'bold 10px Inter';
  c.textAlign = 'center';
  c.fillText('🚨 Spike!', lastX, lastY - 12);

  // X labels
  c.fillStyle = 'rgba(148,163,184,0.5)';
  c.font = '9px Inter';
  const mNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','NOW'];
  data.forEach((_, i) => {
    c.fillText(mNames[i] || '', i * stepX + stepX / 2, H - 4);
  });
}

// ---- MODULE 6: CIRCULAR TRADE GRAPH ----
let circularAngle = 0;
function drawCircularGraph() {
  const canvas = document.getElementById('circularCanvas');
  if (!canvas) return;
  const c = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  c.clearRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2;
  const R = Math.min(W, H) * 0.32;
  const companies = ['Co. A', 'Co. B', 'Co. C'];
  const colors = ['#22d3ee', '#818cf8', '#fb923c'];
  const angles = [Math.PI * 1.5, Math.PI * (1.5 + 2/3), Math.PI * (1.5 + 4/3)];

  const npos = angles.map(a => ({
    x: cx + R * Math.cos(a),
    y: cy + R * Math.sin(a),
  }));

  // Rotating arrow animation
  circularAngle += 0.02;

  // Draw arced arrows between nodes
  for (let i = 0; i < 3; i++) {
    const from = npos[i];
    const to = npos[(i + 1) % 3];
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const ctrl = { x: mx - dy * 0.25, y: my + dx * 0.25 };

    const t = (Math.sin(circularAngle - i * Math.PI * 2 / 3) + 1) / 2;
    const px = (1-t)*(1-t)*from.x + 2*(1-t)*t*ctrl.x + t*t*to.x;
    const py = (1-t)*(1-t)*from.y + 2*(1-t)*t*ctrl.y + t*t*to.y;

    c.beginPath();
    c.moveTo(from.x, from.y);
    c.quadraticCurveTo(ctrl.x, ctrl.y, to.x, to.y);
    c.strokeStyle = `rgba(239,68,68,0.5)`;
    c.lineWidth = 1.5;
    c.setLineDash([5, 3]);
    c.stroke();
    c.setLineDash([]);

    // Particle on curve
    c.beginPath();
    c.arc(px, py, 4, 0, Math.PI * 2);
    c.fillStyle = '#ef4444';
    c.fill();
  }

  // Draw nodes
  npos.forEach((p, i) => {
    const pulse = (Math.sin(circularAngle * 1.5 + i) + 1) / 2;
    c.beginPath();
    c.arc(p.x, p.y, 22 + pulse * 4, 0, Math.PI * 2);
    c.fillStyle = `rgba(239,68,68,${0.08 + 0.1 * pulse})`;
    c.fill();
    c.beginPath();
    c.arc(p.x, p.y, 18, 0, Math.PI * 2);
    c.fillStyle = 'rgba(15,23,42,0.9)';
    c.fill();
    c.strokeStyle = colors[i];
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = '#e2e8f0';
    c.font = 'bold 10px Inter';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(companies[i], p.x, p.y);
  });

  // Center label
  c.fillStyle = 'rgba(239,68,68,0.7)';
  c.font = 'bold 10px Inter';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('CYCLE', cx, cy - 7);
  c.fillStyle = 'rgba(239,68,68,0.5)';
  c.font = '9px Inter';
  c.fillText('DETECTED', cx, cy + 7);

  requestAnimationFrame(drawCircularGraph);
}

// ---- LIVE DEMO CHART ----
let demoChartHistory = [];
function drawDemoChart(riskScore) {
  const canvas = document.getElementById('demoChart');
  if (!canvas) return;
  const c = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  demoChartHistory.push(riskScore);
  if (demoChartHistory.length > 50) demoChartHistory.shift();

  c.clearRect(0, 0, W, H);

  // Grid
  c.strokeStyle = 'rgba(255,255,255,0.05)';
  c.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = (i / 4) * H;
    c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
  }

  // Threshold line
  const threshY = H - (100 / 200) * H;
  c.strokeStyle = 'rgba(239,68,68,0.4)';
  c.setLineDash([6, 4]);
  c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(0, threshY); c.lineTo(W, threshY); c.stroke();
  c.setLineDash([]);
  c.fillStyle = 'rgba(239,68,68,0.5)';
  c.font = '9px Inter';
  c.textAlign = 'right';
  c.fillText('Threshold: 100', W - 4, threshY - 4);

  if (demoChartHistory.length < 2) return;

  const stepX = W / 49;
  const clamp = v => Math.max(0, Math.min(200, v));

  // Fill
  const grad = c.createLinearGradient(0, 0, 0, H);
  if (riskScore > 100) {
    grad.addColorStop(0, 'rgba(239,68,68,0.35)');
    grad.addColorStop(1, 'rgba(239,68,68,0.02)');
  } else {
    grad.addColorStop(0, 'rgba(34,211,238,0.25)');
    grad.addColorStop(1, 'rgba(34,211,238,0.02)');
  }
  c.beginPath();
  c.moveTo(0, H);
  demoChartHistory.forEach((v, i) => {
    const x = (49 - demoChartHistory.length + i + 1) * stepX;
    const y = H - (clamp(v) / 200) * H * 0.9;
    c.lineTo(x, y);
  });
  c.lineTo((49 - demoChartHistory.length + demoChartHistory.length) * stepX, H);
  c.closePath();
  c.fillStyle = grad;
  c.fill();

  // Line
  c.beginPath();
  demoChartHistory.forEach((v, i) => {
    const x = (49 - demoChartHistory.length + i + 1) * stepX;
    const y = H - (clamp(v) / 200) * H * 0.9;
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  });
  c.strokeStyle = riskScore > 100 ? '#ef4444' : '#22d3ee';
  c.lineWidth = 2;
  c.stroke();

  // Dot at end
  const lastX = W;
  const lastY = H - (clamp(riskScore) / 200) * H * 0.9;
  c.beginPath();
  c.arc(lastX - stepX, lastY, 5, 0, Math.PI * 2);
  c.fillStyle = riskScore > 100 ? '#ef4444' : '#22d3ee';
  c.fill();
}

// ---- LIVE DEMO SLIDERS ----
function updateDemo() {
  const amt = parseFloat(document.getElementById('invoiceAmt').value);
  const freq = parseFloat(document.getElementById('invoiceFreq').value);
  const rev = parseFloat(document.getElementById('revenue').value);
  const cap = parseFloat(document.getElementById('prodCap').value);

  document.getElementById('amtVal').textContent = `₹${amt} Cr`;
  document.getElementById('freqVal').textContent = freq;
  document.getElementById('revVal').textContent = `₹${rev} Cr`;
  document.getElementById('capVal').textContent = cap.toLocaleString();

  // Risk computation
  const behaviorRisk = Math.min(100, (freq / 10) * 20);
  const feasibilityRisk = Math.max(0, Math.min(80, ((amt * 10000) > cap ? ((amt * 10000 - cap) / cap) * 30 : 0)));
  const cascadeRisk = Math.min(100, (amt / rev) * 60);
  const dupRisk = freq > 20 ? Math.min(50, freq * 0.6) : 5;
  let totalRisk = behaviorRisk + feasibilityRisk + cascadeRisk + dupRisk;
  totalRisk = Math.round(totalRisk);

  const fai = Math.min(9, ((amt * freq) / (rev * 10))).toFixed(1);
  const trust = Math.max(5, Math.round(100 - totalRisk / 2.5));

  document.getElementById('demoRisk').textContent = totalRisk;
  document.getElementById('demoFAI').textContent = fai;
  document.getElementById('demoTrust').textContent = trust;

  const verdict = document.getElementById('demoVerdict');
  const verdictMsg = document.getElementById('demoVerdictMsg');

  const riskStatus = document.getElementById('demoRiskStatus');
  const faiStatus = document.getElementById('demoFAIStatus');
  const trustStatus = document.getElementById('demoTrustStatus');

  riskStatus.className = 'out-sub' + (totalRisk > 100 ? ' danger' : '');
  faiStatus.className = 'out-sub' + (fai > 3 ? ' danger' : '');
  trustStatus.className = 'out-sub' + (trust < 70 ? ' danger' : '');

  if (totalRisk > 100) {
    verdict.className = 'demo-verdict risk-high';
    document.querySelector('.verdict-icon').textContent = '❌';
    verdictMsg.textContent = 'Disbursement Blocked – Risk too high';
    riskStatus.textContent = '⚠ High Risk';
  } else if (totalRisk > 60) {
    verdict.className = 'demo-verdict';
    verdict.style.background = 'rgba(245,158,11,0.1)';
    verdict.style.borderColor = 'rgba(245,158,11,0.4)';
    document.querySelector('.verdict-icon').textContent = '⚠';
    verdictMsg.textContent = 'Elevated Risk – Manual Review Required';
    riskStatus.textContent = '⚠ Medium Risk';
  } else {
    verdict.className = 'demo-verdict';
    verdict.style.background = '';
    verdict.style.borderColor = '';
    document.querySelector('.verdict-icon').textContent = '✅';
    verdictMsg.textContent = 'Transaction Cleared for Disbursement';
    riskStatus.textContent = '✓ Low Risk';
  }

  faiStatus.textContent = fai > 3 ? '⚠ High FAI' : fai > 2 ? '⚠ Medium' : '✓ Safe';
  trustStatus.textContent = trust < 70 ? '⚠ Low Trust' : '✓ Trusted';

  drawDemoChart(totalRisk);
}

// ---- CONTACT FORM ----
function submitContact(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.textContent = '✓ Request Sent!';
  btn.style.background = 'linear-gradient(135deg,#16a34a,#22c55e)';
  setTimeout(() => {
    btn.textContent = 'Request Demo';
    btn.style.background = '';
    e.target.reset();
  }, 3000);
}

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  // Draw static charts
  drawBehaviorChart();
  drawCircularGraph();
  updateDemo();

  // Smooth scroll for nav links
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Close mobile menu if open
        if (navLinks && navLinks.style.display === 'flex') {
          navLinks.style.display = '';
        }
      }
    });
  });
});
