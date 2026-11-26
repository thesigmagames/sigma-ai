import React, { useState, useEffect } from 'react';

interface CodeStudioProps {
  initialCode?: string;
  onSendToChat: (prompt: string) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type StudioSubMode = 'sandbox' | 'game_builder' | 'css_svg';
type GameTemplateId = 'shooter' | 'space' | 'snake' | 'platform';

const CODE_TEMPLATES = [
  {
    id: 'counter',
    label: 'Sayaç Uygulaması',
    code: `<!DOCTYPE html>
<html lang="tr">
<head>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; }
    .card { width: 320px; padding: 24px; border-radius: 16px; background: #1e293b; border: 1px solid #334155; text-align: center; }
    .val { font-size: 2.5rem; font-weight: 700; margin: 16px 0; color: #38bdf8; }
    .row { display: flex; gap: 10px; justify-content: center; }
    button { padding: 10px 18px; border-radius: 10px; border: 0; font-weight: 600; cursor: pointer; background: #2563eb; color: #fff; }
    button.sec { background: #334155; }
  </style>
</head>
<body>
  <div class="card">
    <h3>Sigma Canlı Sayaç</h3>
    <div class="val" id="num">0</div>
    <div class="row">
      <button class="sec" onclick="degistir(-1)">-1</button>
      <button onclick="degistir(1)">+1</button>
      <button class="sec" onclick="sifirla()">Sıfırla</button>
    </div>
  </div>
  <script>
    let count = 0;
    function degistir(d) {
      count += d;
      document.getElementById('num').textContent = count;
    }
    function sifirla() {
      count = 0;
      document.getElementById('num').textContent = count;
    }
  </script>
</body>
</html>`
  },
  {
    id: 'calc',
    label: 'Hesap Makinesi',
    code: `<!DOCTYPE html>
<html lang="tr">
<head>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f8fafc; font-family: system-ui, sans-serif; }
    .calc { width: 280px; background: #0f172a; padding: 18px; border-radius: 18px; color: #fff; }
    #disp { width: 100%; box-sizing: border-box; padding: 12px; font-size: 1.4rem; text-align: right; border-radius: 10px; border: 0; background: #1e293b; color: #fff; margin-bottom: 12px; font-family: monospace; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    button { padding: 14px; border-radius: 10px; border: 0; background: #334155; color: #fff; font-size: 1rem; font-weight: 600; cursor: pointer; }
    button.eq { background: #2563eb; grid-column: span 2; }
  </style>
</head>
<body>
  <div class="calc">
    <input id="disp" readonly value="0" />
    <div class="grid">
      <button onclick="clr()">C</button><button onclick="add('/')">/</button><button onclick="add('*')">*</button><button onclick="add('-')">-</button>
      <button onclick="add('7')">7</button><button onclick="add('8')">8</button><button onclick="add('9')">9</button><button onclick="add('+')">+</button>
      <button onclick="add('4')">4</button><button onclick="add('5')">5</button><button onclick="add('6')">6</button><button onclick="add('.')">.</button>
      <button onclick="add('1')">1</button><button onclick="add('2')">2</button><button onclick="add('3')">3</button><button onclick="add('0')">0</button>
      <button class="eq" onclick="solve()">=</button>
    </div>
  </div>
  <script>
    let expr = '';
    const d = document.getElementById('disp');
    function add(v) { expr += v; d.value = expr; }
    function clr() { expr = ''; d.value = '0'; }
    function solve() {
      try { expr = String(Function('return (' + expr + ')')()); d.value = expr; }
      catch { d.value = 'Hata'; expr = ''; }
    }
  </script>
</body>
</html>`
  },
  {
    id: 'paint',
    label: 'Çizim Tahtası',
    code: `<!DOCTYPE html>
<html lang="tr">
<head>
  <style>
    body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; background: #0f172a; color: #fff; font-family: system-ui, sans-serif; }
    .bar { display: flex; gap: 8px; align-items: center; }
    canvas { background: #fff; border-radius: 12px; cursor: crosshair; touch-action: none; }
    button { padding: 6px 12px; border: 0; border-radius: 8px; background: #2563eb; color: #fff; font-weight: 600; cursor: pointer; }
  </style>
</head>
<body>
  <div class="bar">
    <input type="color" id="col" value="#2563eb" />
    <input type="range" id="sz" min="2" max="24" value="6" />
    <button onclick="ctx.clearRect(0,0,c.width,c.height)">Temizle</button>
  </div>
  <canvas id="c" width="380" height="280"></canvas>
  <script>
    const c = document.getElementById('c'), ctx = c.getContext('2d');
    let d = false; ctx.lineCap = 'round';
    c.onpointerdown = e => { d = true; ctx.beginPath(); ctx.moveTo(e.offsetX, e.offsetY); };
    c.onpointermove = e => { if (!d) return; ctx.strokeStyle = col.value; ctx.lineWidth = sz.value; ctx.lineTo(e.offsetX, e.offsetY); ctx.stroke(); };
    window.onpointerup = () => { d = false; };
  </script>
</body>
</html>`
  }
];

function build2DGameHtml(tpl: GameTemplateId, speed: number, gravity: number, heroColor: string): string {
  if (tpl === 'shooter') {
    return `<!DOCTYPE html>
<html lang="tr">
<head>
  <style>
    body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #070b14; color: #f8fafc; font-family: system-ui, sans-serif; }
    .bar { width: 420px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 13px; font-weight: 700; font-family: monospace; }
    .bar button { padding: 4px 10px; border-radius: 6px; border: 1px solid #334155; background: #1e293b; color: #f8fafc; cursor: pointer; font-size: 11px; }
    canvas { background: radial-gradient(circle at top, #172554, #070b14); border: 2px solid ${heroColor}; border-radius: 12px; }
  </style>
</head>
<body>
  <div class="bar">
    <span id="hud">SKOR: 0 · CAN: 3</span>
    <div>
      <button onclick="togglePause()">Duraklat (P)</button>
      <button onclick="toggleMute()" id="muteBtn">Ses: Açık</button>
    </div>
  </div>
  <canvas id="c" width="420" height="320"></canvas>
  <script>
    const c = document.getElementById('c'), ctx = c.getContext('2d');
    const actx = window.AudioContext ? new AudioContext() : null;
    let muted = false, state = 'TITLE_MENU';
    let shipX = 210, score = 0, lives = 3, bullets = [], enemies = [], spawnT = 0;
    const keys = {};

    function sfx(freq, dur) {
      if (muted || !actx) return;
      if (actx.state === 'suspended') actx.resume();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'square'; o.frequency.setValueAtTime(freq, actx.currentTime);
      g.gain.setValueAtTime(0.08, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
      o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + dur);
    }
    function toggleMute() { muted = !muted; document.getElementById('muteBtn').textContent = muted ? 'Ses: Kapalı' : 'Ses: Açık'; }
    function togglePause() { if (state === 'PLAYING') state = 'PAUSED'; else if (state === 'PAUSED') state = 'PLAYING'; }
    function startGame() { score = 0; lives = 3; bullets = []; enemies = []; shipX = 210; state = 'PLAYING'; updateHud(); }
    function updateHud() { document.getElementById('hud').textContent = 'SKOR: ' + score + ' · CAN: ' + lives; }

    window.addEventListener('keydown', e => {
      keys[e.code] = true;
      if (e.code === 'KeyP') togglePause();
      if (e.code === 'Space') {
        if (state === 'TITLE_MENU' || state === 'GAME_OVER') startGame();
        else if (state === 'PLAYING') { bullets.push({ x: shipX, y: 270 }); sfx(620, 0.08); }
      }
    });
    window.addEventListener('keyup', e => { keys[e.code] = false; });
    c.addEventListener('click', () => {
      if (state === 'TITLE_MENU' || state === 'GAME_OVER') startGame();
      else if (state === 'PLAYING') { bullets.push({ x: shipX, y: 270 }); sfx(620, 0.08); }
    });

    function loop() {
      ctx.clearRect(0, 0, 420, 320);
      if (state === 'PLAYING') {
        if (keys['ArrowLeft'] || keys['KeyA']) shipX = Math.max(24, shipX - ${speed} * 0.7);
        if (keys['ArrowRight'] || keys['KeyD']) shipX = Math.min(396, shipX + ${speed} * 0.7);
        spawnT++;
        if (spawnT > Math.max(18, 52 - ${speed} * 3)) {
          enemies.push({ x: 24 + Math.random() * 372, y: -12, sp: 1 + ${gravity} * 0.22 });
          spawnT = 0;
        }
        bullets.forEach(b => b.y -= 7);
        bullets = bullets.filter(b => b.y > -10);
        enemies.forEach(en => en.y += en.sp);
        for (let i = enemies.length - 1; i >= 0; i--) {
          const en = enemies[i];
          let hit = false;
          for (let j = bullets.length - 1; j >= 0; j--) {
            if (Math.hypot(en.x - bullets[j].x, en.y - bullets[j].y) < 16) {
              bullets.splice(j, 1); enemies.splice(i, 1); score += 10; sfx(340, 0.1); updateHud(); hit = true; break;
            }
          }
          if (!hit && en.y > 315) {
            enemies.splice(i, 1); lives--; sfx(130, 0.18); updateHud();
            if (lives <= 0) state = 'GAME_OVER';
          }
        }
      }
      ctx.fillStyle = '${heroColor}';
      ctx.beginPath(); ctx.moveTo(shipX, 272); ctx.lineTo(shipX - 14, 298); ctx.lineTo(shipX + 14, 298); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fef08a';
      bullets.forEach(b => ctx.fillRect(b.x - 2, b.y - 6, 4, 10));
      ctx.fillStyle = '#f43f5e';
      enemies.forEach(en => { ctx.beginPath(); ctx.arc(en.x, en.y, 11, 0, Math.PI * 2); ctx.fill(); });

      if (state !== 'PLAYING') {
        ctx.fillStyle = 'rgba(7, 11, 20, 0.72)'; ctx.fillRect(0, 0, 420, 320);
        ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.font = 'bold 20px sans-serif';
        ctx.fillText(state === 'TITLE_MENU' ? 'UZAY SAVUNMASI' : state === 'PAUSED' ? 'DURAKLATILDI' : 'OYUN BİTTİ · SKOR: ' + score, 210, 145);
        ctx.font = '13px sans-serif'; ctx.fillStyle = '#94a3b8';
        ctx.fillText(state === 'PAUSED' ? 'Devam etmek için P tuşuna bas' : 'Başlamak için Tıkla veya Boşluk (Ok Tuşları + Ateş)', 210, 175);
      }
      requestAnimationFrame(loop);
    }
    loop();
  </script>
</body>
</html>`;
  }

  if (tpl === 'snake') {
    return `<!DOCTYPE html>
<html lang="tr">
<head>
  <style>
    body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0b1120; color: #f8fafc; font-family: system-ui, sans-serif; }
    canvas { background: #0f172a; border: 2px solid ${heroColor}; border-radius: 12px; }
    .hud { margin-bottom: 10px; font-weight: 700; font-family: monospace; }
  </style>
</head>
<body>
  <div class="hud" id="hud">Skor: 0 · Yön Tuşları ile Oyna</div>
  <canvas id="c" width="360" height="360"></canvas>
  <script>
    const c = document.getElementById('c'), ctx = c.getContext('2d');
    const grid = 18;
    let snake = [{x: 10, y: 10}], dx = 1, dy = 0, food = {x: 15, y: 10}, score = 0;
    window.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp' && dy === 0) { dx = 0; dy = -1; }
      if (e.key === 'ArrowDown' && dy === 0) { dx = 0; dy = 1; }
      if (e.key === 'ArrowLeft' && dx === 0) { dx = -1; dy = 0; }
      if (e.key === 'ArrowRight' && dx === 0) { dx = 1; dy = 0; }
    });
    setInterval(() => {
      const head = {x: (snake[0].x + dx + 20) % 20, y: (snake[0].y + dy + 20) % 20};
      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        score += 10;
        document.getElementById('hud').textContent = 'Skor: ' + score;
        food = {x: Math.floor(Math.random()*20), y: Math.floor(Math.random()*20)};
      } else snake.pop();
      ctx.clearRect(0, 0, 360, 360);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(food.x*grid+2, food.y*grid+2, grid-4, grid-4);
      ctx.fillStyle = '${heroColor}';
      snake.forEach(s => ctx.fillRect(s.x*grid+1, s.y*grid+1, grid-2, grid-2));
    }, Math.max(55, 200 - ${speed} * 15));
  </script>
</body>
</html>`;
  }

  if (tpl === 'platform') {
    return `<!DOCTYPE html>
<html lang="tr">
<head>
  <style>
    body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0b1120; color: #f8fafc; font-family: system-ui, sans-serif; }
    canvas { background: #0f172a; border: 2px solid ${heroColor}; border-radius: 12px; cursor: pointer; }
    .hud { margin-bottom: 10px; font-weight: 700; font-family: monospace; }
  </style>
</head>
<body>
  <div class="hud" id="hud">Zıplamak için Tıkla veya Boşluk Tuşu · Skor: 0</div>
  <canvas id="c" width="420" height="260"></canvas>
  <script>
    const c = document.getElementById('c'), ctx = c.getContext('2d');
    let py = 200, vy = 0, ox = 420, score = 0;
    function jump() { if (py >= 198) vy = -11; }
    window.addEventListener('keydown', e => { if (e.code === 'Space') jump(); });
    c.addEventListener('click', jump);
    function loop() {
      vy += ${gravity} * 0.08; py += vy;
      if (py > 200) { py = 200; vy = 0; }
      ox -= ${speed} * 0.85;
      if (ox < -24) { ox = 420; score += 1; document.getElementById('hud').textContent = 'Skor: ' + score; }
      if (ox < 84 && ox > 36 && py > 172) { score = 0; ox = 420; document.getElementById('hud').textContent = 'Çarpıştın! Skor: 0'; }
      ctx.clearRect(0, 0, 420, 260);
      ctx.fillStyle = '#334155'; ctx.fillRect(0, 228, 420, 32);
      ctx.fillStyle = '${heroColor}'; ctx.fillRect(50, py, 28, 28);
      ctx.fillStyle = '#f43f5e'; ctx.fillRect(ox, 198, 24, 30);
      requestAnimationFrame(loop);
    }
    loop();
  </script>
</body>
</html>`;
  }

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <style>
    body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0b1120; color: #f8fafc; font-family: system-ui, sans-serif; }
    canvas { background: radial-gradient(circle at top, #1e293b, #090d16); border: 2px solid ${heroColor}; border-radius: 12px; cursor: crosshair; }
    .hud { margin-bottom: 10px; font-weight: 700; font-family: monospace; }
  </style>
</head>
<body>
  <div class="hud" id="hud">Hedefe Tıkla & Vur · Skor: 0</div>
  <canvas id="c" width="420" height="280"></canvas>
  <script>
    const c = document.getElementById('c'), ctx = c.getContext('2d');
    let score = 0, tx = 200, ty = 120, vx = ${speed} * 0.6, vy = ${gravity} * 0.45;
    c.addEventListener('click', e => {
      const r = c.getBoundingClientRect();
      if (Math.hypot(e.clientX - r.left - tx, e.clientY - r.top - ty) < 28) {
        score += 15;
        document.getElementById('hud').textContent = 'Skor: ' + score;
      }
    });
    function loop() {
      ctx.clearRect(0, 0, 420, 280);
      tx += vx; ty += vy;
      if (tx < 24 || tx > 396) vx *= -1;
      if (ty < 24 || ty > 256) vy *= -1;
      ctx.fillStyle = '${heroColor}';
      ctx.beginPath(); ctx.arc(tx, ty, 20, 0, Math.PI * 2); ctx.fill();
      requestAnimationFrame(loop);
    }
    loop();
  </script>
</body>
</html>`;
}

export const CodeStudio: React.FC<CodeStudioProps> = ({ initialCode, onSendToChat, onNotify }) => {
  const [subMode, setSubMode] = useState<StudioSubMode>('sandbox');
  const [code, setCode] = useState<string>(initialCode || CODE_TEMPLATES[0].code);
  const [runVersion, setRunVersion] = useState(0);
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  // 2B Oyun Yapıcı parametreleri
  const [gameTpl, setGameTpl] = useState<GameTemplateId>('platform');
  const [gameSpeed, setGameSpeed] = useState(6);
  const [gameGravity, setGameGravity] = useState(6);
  const [heroColor, setHeroColor] = useState('#38bdf8');

  // CSS & SVG Laboratuvarı
  const [gradStart, setGradStart] = useState('#2563eb');
  const [gradEnd, setGradEnd] = useState('#7c3aed');
  const [glassBlur, setGlassBlur] = useState(14);
  const [svgSpokes, setSvgSpokes] = useState(8);

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
      setSubMode('sandbox');
      setRunVersion((v) => v + 1);
    }
  }, [initialCode]);

  const applyGeneratedGame = (tpl = gameTpl, spd = gameSpeed, grav = gameGravity, col = heroColor) => {
    const generated = build2DGameHtml(tpl, spd, grav, col);
    setCode(generated);
    setRunVersion((v) => v + 1);
  };

  const generatedCssSnippet = `.sigma-glass-card {
  background: linear-gradient(135deg, ${gradStart}cc, ${gradEnd}cc);
  backdrop-filter: blur(${glassBlur}px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  padding: 24px;
  color: #ffffff;
}`;

  const generatedSvgMarkup = `<svg viewBox="0 0 200 200" width="180" height="180" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${gradStart}" />
      <stop offset="100%" stop-color="${gradEnd}" />
    </linearGradient>
  </defs>
  <rect width="200" height="200" rx="28" fill="#0f172a" />
  ${Array.from({ length: svgSpokes })
    .map((_, i) => {
      const deg = (360 / svgSpokes) * i;
      return `<ellipse cx="100" cy="100" rx="68" ry="20" fill="none" stroke="url(#sg)" stroke-width="2.5" transform="rotate(${deg.toFixed(1)} 100 100)" />`;
    })
    .join('\n  ')}
  <circle cx="100" cy="100" r="14" fill="url(#sg)" />
</svg>`;

  const handleDownloadHtml = () => {
    const blob = new Blob([code], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sigma-sandbox-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onNotify('HTML dosyası indirildi.', 'success');
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Üst Mod & Araç Çubuğu */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'sandbox' as StudioSubMode, label: 'Canlı Kod Sandbox', icon: 'fa-code' },
              { id: 'game_builder' as StudioSubMode, label: '2B Oyun Yapıcı', icon: 'fa-gamepad' },
              { id: 'css_svg' as StudioSubMode, label: 'CSS & SVG Üretici', icon: 'fa-bezier-curve' }
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setSubMode(m.id);
                  if (m.id === 'game_builder') applyGeneratedGame();
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  subMode === m.id
                    ? 'sigma-accent-bg text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <i className={`fa-solid ${m.icon}`} />
                <span>{m.label}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {subMode === 'sandbox' &&
              CODE_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    setCode(tpl.code);
                    setRunVersion((v) => v + 1);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer whitespace-nowrap"
                >
                  {tpl.label}
                </button>
              ))}
            <button
              type="button"
              onClick={() => setRunVersion((v) => v + 1)}
              className="px-3 py-1.5 rounded-lg sigma-accent-bg text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <i className="fa-solid fa-play mr-1.5" />
              Çalıştır
            </button>
            <button
              type="button"
              onClick={handleDownloadHtml}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
            >
              <i className="fa-solid fa-download mr-1.5" />
              HTML İndir
            </button>
            <button
              type="button"
              onClick={() =>
                onSendToChat(`Aşağıdaki kodu incele, hataları varsa düzelt ve geliştir:\n\n\`\`\`html\n${code}\n\`\`\``)
              }
              className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <i className="fa-solid fa-wand-magic-sparkles mr-1.5" />
              AI ile İncele
            </button>
          </div>
        </div>

        {/* 2B Oyun Yapıcı Kontrolleri */}
        {subMode === 'game_builder' && (
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 grid grid-cols-1 sm:grid-cols-4 gap-3 items-center text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Oyun Motoru Şablonu</label>
              <select
                value={gameTpl}
                onChange={(e) => {
                  const val = e.target.value as GameTemplateId;
                  setGameTpl(val);
                  applyGeneratedGame(val, gameSpeed, gameGravity, heroColor);
                }}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
              >
                <option value="shooter">Uzay Savunması Shooter</option>
                <option value="platform">Platform Zıplama</option>
                <option value="snake">Klasik Yılan</option>
                <option value="space">Hedef Vurma Arenası</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Hız: <span className="font-mono tabular-nums">{gameSpeed}</span>
              </label>
              <input
                type="range"
                min={2}
                max={10}
                value={gameSpeed}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setGameSpeed(v);
                  applyGeneratedGame(gameTpl, v, gameGravity, heroColor);
                }}
                className="w-full accent-blue-600"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Yerçekimi / İvme: <span className="font-mono tabular-nums">{gameGravity}</span>
              </label>
              <input
                type="range"
                min={2}
                max={10}
                value={gameGravity}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setGameGravity(v);
                  applyGeneratedGame(gameTpl, gameSpeed, v, heroColor);
                }}
                className="w-full accent-blue-600"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Karakter Rengi</label>
              <div className="flex items-center gap-2">
                {['#38bdf8', '#22c55e', '#f59e0b', '#ec4899'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setHeroColor(c);
                      applyGeneratedGame(gameTpl, gameSpeed, gameGravity, c);
                    }}
                    className={`w-6 h-6 rounded-full cursor-pointer ${heroColor === c ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CSS & SVG Üretici Paneli */}
        {subMode === 'css_svg' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Cam Efekti (Glassmorphism CSS) & SVG Geometri Tasarımcısı
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <label className="space-y-1">
                  <span className="font-medium text-slate-600 dark:text-slate-400">Başlangıç Rengi</span>
                  <input
                    type="color"
                    value={gradStart}
                    onChange={(e) => setGradStart(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
                  />
                </label>
                <label className="space-y-1">
                  <span className="font-medium text-slate-600 dark:text-slate-400">Bitiş Rengi</span>
                  <input
                    type="color"
                    value={gradEnd}
                    onChange={(e) => setGradEnd(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
                  />
                </label>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Cam Bulanıklığı: <strong className="font-mono">{glassBlur}px</strong></span>
                  <span>SVG Halkaları: <strong className="font-mono">{svgSpokes}</strong></span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="range" min={0} max={32} value={glassBlur} onChange={(e) => setGlassBlur(Number(e.target.value))} className="accent-blue-600" />
                  <input type="range" min={3} max={18} value={svgSpokes} onChange={(e) => setSvgSpokes(Number(e.target.value))} className="accent-blue-600" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span>Üretilen CSS</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedCssSnippet);
                      onNotify('CSS kodu kopyalandı.', 'success');
                    }}
                    className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    CSS Kopyala
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-slate-950 text-slate-100 font-mono text-[11px] overflow-x-auto">
                  {generatedCssSnippet}
                </pre>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span>Parametrik SVG Kodu</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedSvgMarkup);
                      onNotify('SVG kodu kopyalandı.', 'success');
                    }}
                    className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    SVG Kopyala
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-slate-950 text-slate-100 font-mono text-[11px] max-h-36 overflow-auto">
                  {generatedSvgMarkup}
                </pre>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950 flex flex-col items-center justify-center gap-6 min-h-[420px]">
              <div
                className="w-72 p-6 rounded-2xl border border-white/20 text-white shadow-xl"
                style={{
                  background: `linear-gradient(135deg, ${gradStart}cc, ${gradEnd}cc)`,
                  backdropFilter: `blur(${glassBlur}px)`
                }}
              >
                <div className="text-sm font-bold">Sigma UI Kart Önizlemesi</div>
                <p className="text-xs opacity-90 mt-1">
                  Canlı CSS renk geçişi ve cam efekti parametreleri anlık güncellenir.
                </p>
              </div>

              <div dangerouslySetInnerHTML={{ __html: generatedSvgMarkup }} />
            </div>
          </div>
        ) : (
          /* Bölünmüş Editör & Canlı Oyun/Kod Önizlemesi */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[500px]">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-900 overflow-hidden flex flex-col">
              <div className="px-4 py-2.5 bg-slate-800 text-xs font-mono text-slate-300 border-b border-slate-700">
                index.html (Düzenleyici)
              </div>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                spellCheck={false}
                className="flex-1 w-full min-h-[450px] p-4 bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed resize-none focus:outline-none"
              />
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
              <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                <span>Canlı Çalışma Alanı</span>
                <div className="flex items-center gap-1">
                  {[
                    { id: 'desktop' as const, icon: 'fa-desktop', title: 'Masaüstü (%100)' },
                    { id: 'tablet' as const, icon: 'fa-tablet-screen-button', title: 'Tablet (768px)' },
                    { id: 'mobile' as const, icon: 'fa-mobile-screen-button', title: 'Mobil (375px)' }
                  ].map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      title={v.title}
                      onClick={() => setViewport(v.id)}
                      className={`w-7 h-7 rounded-md flex items-center justify-center cursor-pointer transition-colors ${
                        viewport === v.id
                          ? 'sigma-accent-bg text-white'
                          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                      }`}
                    >
                      <i className={`fa-solid ${v.icon}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 bg-slate-100 dark:bg-slate-950 flex justify-center p-2 overflow-auto">
                <iframe
                  key={runVersion}
                  title="Sigma Kod Sandbox"
                  srcDoc={code}
                  sandbox="allow-scripts allow-modals"
                  style={{
                    width: viewport === 'mobile' ? '375px' : viewport === 'tablet' ? '768px' : '100%',
                    maxWidth: '100%'
                  }}
                  className="h-full min-h-[450px] bg-white rounded-lg border border-slate-200 dark:border-slate-800 transition-all duration-200"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
