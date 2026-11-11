#!/usr/bin/env node
/*
 * Twelve Yards - software verification runner.
 *
 * Executes the software verification cases against index.html in headless
 * Chromium and regenerates:
 *   docs/03-software-verification-cases.md
 *   docs/04-software-verification-results.md
 *
 * Usage:  npm install && npm run verify
 */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { execSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const PAGE = 'file://' + path.join(ROOT, 'index.html');
const THREE_LOCAL = process.env.THREE_PATH || path.join(ROOT, 'node_modules/three/build/three.min.js');
const HAS_LOCAL_THREE = fs.existsSync(THREE_LOCAL);

function ok(cond, msg) { if (!cond) throw new Error(msg); }
function near(a, b, tol, what) { ok(Math.abs(a - b) <= tol, `${what}: got ${a}, expected ${b} ± ${tol}`); }
const f2 = n => Number(n).toFixed(2);

/* Functions evaluated inside the page. */
const HELPERS = `window.__h = {
  // Take one kick synchronously. kp = keeper hands (your kick) or glove position (their kick).
  kick(turn, tx, ty, T, curve, kp) {
    const t = __twelveYards; t.beginTurn(turn); t.clearTimers();
    if (turn === 'you') { t.K.P.x = kp.x; t.K.P.y = kp.y; t.K.base = kp.x; t.poseKeeper(); }
    else { t.GL.P.x = t.GL.T.x = kp.x; t.GL.P.y = t.GL.T.y = kp.y; }
    const before = t.S[turn].length; t.launch(tx, ty, T, curve || 0);
    let n = 0; while (!t.fl.done && n++ < 4000) t.stepBall(1 / 240);
    const b = document.getElementById('banner'), sm = b.querySelector('small');
    return { done: t.fl.done, recorded: t.S[turn].length - before, goal: t.S[turn][t.S[turn].length - 1],
      inNet: t.fl.inNet, vz: t.vel.z, cls: b.className, speed: t.fl.speed,
      banner: b.childNodes[0] ? b.childNodes[0].textContent : '', sub: sm ? sm.textContent : '' };
  },
  // Play a whole match through the real turn flow with scripted outcomes (true = goal).
  match(youPlan, cpuPlan) {
    const t = __twelveYards, log = []; let forced = -1, guard = 0;
    const pips = id => [...document.getElementById(id).children].map(e => e.className.replace('pip', '').trim());
    const snap = () => log.push({ turn: t.S.turn, phase: document.getElementById('phase').textContent,
      you: pips('pipsYou'), cpu: pips('pipsCpu') });
    while (t.S.state !== 'over' && guard++ < 400000) {
      if (t.S.state === 'aim') {
        snap(); t.K.rd = 99;
        t.launch(youPlan[t.S.you.length] ? 2.5 : 5.5, 1.0, 0.5, 0);
      } else if (t.S.state === 'flight' && t.S.turn === 'cpu' && forced !== t.S.cpu.length) {
        forced = t.S.cpu.length; snap(); t.resetBall();
        t.GL.P.x = t.GL.T.x = -3; t.GL.P.y = t.GL.T.y = 0.5;
        t.launch(cpuPlan[forced] ? 2.5 : 5.5, 1.0, 0.5, 0);
      }
      t.tick(1 / 60);
    }
    const txt = id => document.getElementById(id).textContent;
    return { over: t.S.state === 'over', you: t.S.you.slice(), cpu: t.S.cpu.slice(), log,
      title: txt('ovTitle'), text: txt('ovText'), eyebrow: txt('ovEyebrow'), button: txt('go'),
      sYou: txt('sYou'), sCpu: txt('sCpu'), overlayHidden: document.getElementById('overlay').hidden };
  }
};`;

async function open(browser, opts = {}) {
  const ctx = await browser.newContext({
    viewport: opts.viewport || { width: 1100, height: 650 },
    reducedMotion: opts.reducedMotion || 'no-preference',
  });
  const page = await ctx.newPage();
  page.errors = []; page.requests = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('request', r => page.requests.push(r.url()));
  await page.route('**/three.min.js', r => {
    if (opts.blockThree) return r.abort();
    return HAS_LOCAL_THREE ? r.fulfill({ path: THREE_LOCAL, contentType: 'text/javascript' }) : r.continue();
  });
  await page.goto(PAGE);
  if (!opts.blockThree) {
    await page.waitForFunction(() => !!window.__twelveYards, null, { timeout: 15000 });
    await page.evaluate(HELPERS);
  }
  return page;
}
const pause = page => page.evaluate(() => __twelveYards.pause(true));
async function startLive(page) {
  await page.click('#go');
  await page.waitForFunction(() => __twelveYards.S.state === 'aim', null, { timeout: 15000 });
}
async function startPaused(page) { await pause(page); await page.click('#go'); }
const rearm = page => page.evaluate(() => { const t = __twelveYards; t.beginTurn('you'); t.clearTimers(); t.S.state = 'aim'; });
async function drag(page, pts, delay) {
  await page.mouse.move(pts[0][0], pts[0][1]); await page.mouse.down();
  for (const p of pts.slice(1)) { await page.mouse.move(p[0], p[1]); if (delay) await page.waitForTimeout(delay); }
}

/* ------------------------------------------------------------------ */
const CASES = [
{ id: 'SVC-001', title: 'Page loads and renders with three.js r128', verifies: ['SWR-001'], method: 'Test',
  steps: ['Open index.html at 1100×650.', 'Read the three.js revision, the canvas size and the script errors raised during load.'],
  expected: ['No script errors.', 'three.js revision is 128.', 'The canvas fills the viewport and has a WebGL context.'],
  async run(b) {
    const p = await open(b);
    const r = await p.evaluate(() => { const c = document.getElementById('gl');
      return { rev: THREE.REVISION, w: c.clientWidth, h: c.clientHeight, iw: innerWidth, ih: innerHeight,
        gl: !!(c.getContext('webgl2') || c.getContext('webgl')) }; });
    ok(p.errors.length === 0, 'script errors: ' + p.errors.join('; '));
    ok(r.rev === '128', 'revision ' + r.rev); ok(r.gl, 'no WebGL context');
    ok(r.w === r.iw && r.h === r.ih, `canvas ${r.w}×${r.h} vs viewport ${r.iw}×${r.ih}`);
    return `0 errors; revision ${r.rev}; canvas ${r.w}×${r.h} = viewport`;
  } },

{ id: 'SVC-002', title: 'Physical constants', verifies: ['SWR-002'], method: 'Test',
  steps: ['Read the constants through the verification interface.'],
  expected: ['Goal 7.32 m × 2.44 m, ball radius 0.11 m, penalty spot 11 m from the goal line, gravity 9.81 m/s².'],
  async run(b) {
    const p = await open(b); const c = await p.evaluate(() => __twelveYards.consts);
    ok(c.GW === 7.32 && c.GH === 2.44 && c.BR === 0.11 && c.SPOT === 11 && c.G === 9.81, JSON.stringify(c));
    return `GW=${c.GW}, GH=${c.GH}, BR=${c.BR}, SPOT=${c.SPOT}, G=${c.G}`;
  } },

{ id: 'SVC-003', title: 'Start screen and kick-off', verifies: ['SWR-003', 'SWR-018', 'SWR-020', 'SWR-023'], method: 'Test',
  steps: ['Open the page and read the start screen.', 'Press "Kick off".', 'Read the HUD and game state.'],
  expected: ['Before start: overlay shown with title, both control instructions and a "Kick off" button; HUD hidden.',
    'After start: overlay hidden, HUD shown, it is the player\'s turn, score 0–0, phase "Kick 1 of 5 · Your kick".'],
  async run(b) {
    const p = await open(b);
    const a = await p.evaluate(() => ({ ov: !document.getElementById('overlay').hidden, hud: document.getElementById('hud').hidden,
      title: document.getElementById('ovTitle').textContent, how: document.getElementById('ovHow').textContent,
      btn: document.getElementById('go').textContent, state: __twelveYards.S.state }));
    ok(a.ov && a.hud && a.state === 'menu', 'start state ' + JSON.stringify(a));
    ok(a.title === 'Twelve Yards' && a.btn === 'Kick off' && /Your kick/.test(a.how) && /Their kick/.test(a.how), 'start content');
    await p.click('#go');
    const r = await p.evaluate(() => ({ ov: document.getElementById('overlay').hidden, hud: !document.getElementById('hud').hidden,
      turn: __twelveYards.S.turn, phase: document.getElementById('phase').textContent,
      score: document.getElementById('sYou').textContent + '–' + document.getElementById('sCpu').textContent }));
    ok(r.ov && r.hud && r.turn === 'you', 'after start ' + JSON.stringify(r));
    ok(r.phase === 'Kick 1 of 5 · Your kick' && r.score === '0–0', r.phase + ' / ' + r.score);
    return `overlay→hidden, HUD→shown, turn=${r.turn}, score ${r.score}, phase "${r.phase}"`;
  } },

{ id: 'SVC-004', title: 'Shootout decision rule', verifies: ['SWR-004', 'SWR-005'], method: 'Test',
  steps: ['Load each kick history below into the game state and call the decision function.',
    'G = goal, M = miss. You GGG / CPU MM → undecided. You GGG / CPU MMM → you. You MMM / CPU GGG → CPU. ' +
    'You GGGG / CPU GMM → you. You GGGMM / CPU GGGMM → undecided. You GGGMM+G / CPU GGGMM → undecided (unequal kicks). ' +
    'You GGGMM+G / CPU GGGMM+M → you. You GGGMM+M / CPU GGGMM+G → CPU. You GGGMM+G / CPU GGGMM+G → undecided.'],
  expected: ['Every history returns the winner stated in the steps.'],
  async run(b) {
    const p = await open(b);
    const T = [['GGG', 'MM', null], ['GGG', 'MMM', 'you'], ['MMM', 'GGG', 'cpu'], ['GGGG', 'GMM', 'you'],
      ['GGGMM', 'GGGMM', null], ['GGGMMG', 'GGGMM', null], ['GGGMMG', 'GGGMMM', 'you'], ['GGGMMM', 'GGGMMG', 'cpu'], ['GGGMMG', 'GGGMMG', null]];
    const got = await p.evaluate(T => T.map(r => { const t = __twelveYards;
      t.S.you = [...r[0]].map(c => c === 'G'); t.S.cpu = [...r[1]].map(c => c === 'G'); return t.decided(); }), T);
    T.forEach((r, i) => ok(got[i] === r[2], `${r[0]} v ${r[1]}: got ${got[i]}, expected ${r[2]}`));
    return `${T.length}/${T.length} histories decided as specified`;
  } },

{ id: 'SVC-005', title: 'Full match decided inside five kicks', verifies: ['SWR-003', 'SWR-004', 'SWR-018', 'SWR-019', 'SWR-020', 'SWR-022', 'SWR-024'], method: 'Test',
  steps: ['Start a match and drive it through the normal turn flow with scripted outcomes: you score three, the CPU misses three.',
    'Record who kicks, the phase label and the pips at each kick, and the result screen.'],
  expected: ['Kicks alternate starting with the player.', 'The match ends after three kicks each.',
    'Result screen shows "You win", the score 3–0 and a "Play again" button; scoreboard shows 3 and 0.',
    'At the player\'s third kick the player pips read goal, goal, current, pending, pending.'],
  async run(b) {
    const p = await open(b); await startPaused(p);
    const r = await p.evaluate(() => __h.match([1, 1, 1, 1, 1], [0, 0, 0, 0, 0]));
    ok(r.over, 'match did not finish');
    const order = r.log.map(l => l.turn).join(',');
    ok(order === 'you,cpu,you,cpu,you,cpu', 'order ' + order);
    ok(r.you.length === 3 && r.cpu.length === 3, `kicks ${r.you.length}/${r.cpu.length}`);
    ok(r.title === 'You win' && /3–0/.test(r.text) && r.button === 'Play again' && !r.overlayHidden, r.title + ' | ' + r.text);
    ok(r.sYou === '3' && r.sCpu === '0', 'scoreboard ' + r.sYou + '-' + r.sCpu);
    ok(r.log[4].you.join('|') === 'in|in|now||', 'pips ' + r.log[4].you.join('|'));
    ok(r.log[0].phase === 'Kick 1 of 5 · Your kick' && r.log[3].phase === 'Kick 2 of 5 · Their kick', 'phases');
    return `order ${order}; ended 3 kicks each; "${r.title}", "${r.text}"; pips at kick 3: ${r.log[4].you.map(x => x || 'pending').join(', ')}`;
  } },

{ id: 'SVC-006', title: 'Sudden death and replay', verifies: ['SWR-005', 'SWR-019', 'SWR-020', 'SWR-024'], method: 'Test',
  steps: ['Play one scripted match to the end, then press "Play again".', 'Check the score and history are cleared.',
    'Script the new match: both sides score all five; in sudden death you score and the CPU misses.'],
  expected: ['After "Play again": score 0–0, no kicks recorded, overlay hidden.', 'The match continues past five kicks each and ends after six each.',
    'Phase label reads "Sudden death · Your kick" for the sixth kick, and the player pips show only the sudden-death kick.',
    'Result screen shows "You win", 6–5 and "sudden death".'],
  async run(b) {
    const p = await open(b); await startPaused(p);
    await p.evaluate(() => __h.match([0, 0, 0], [1, 1, 1]));
    await p.click('#go');
    const z = await p.evaluate(() => ({ y: __twelveYards.S.you.length, c: __twelveYards.S.cpu.length,
      s: document.getElementById('sYou').textContent + '–' + document.getElementById('sCpu').textContent, ov: document.getElementById('overlay').hidden }));
    ok(z.y === 0 && z.c === 0 && z.s === '0–0' && z.ov, 'replay reset ' + JSON.stringify(z));
    const r = await p.evaluate(() => __h.match([1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 0]));
    ok(r.over && r.you.length === 6 && r.cpu.length === 6, `kicks ${r.you.length}/${r.cpu.length}`);
    const sd = r.log[10];
    ok(sd.phase === 'Sudden death · Your kick', 'phase ' + sd.phase);
    ok(sd.you.join('|') === 'now', 'sudden-death pips ' + sd.you.join('|'));
    ok(r.title === 'You win' && /6–5/.test(r.text) && /sudden death/.test(r.eyebrow), r.title + ' | ' + r.text + ' | ' + r.eyebrow);
    return `reset to ${z.s}; ended 6 kicks each; phase "${sd.phase}"; "${r.title}", "${r.text}", "${r.eyebrow}"`;
  } },

{ id: 'SVC-007', title: 'Defeat and early finish with unequal kicks', verifies: ['SWR-004', 'SWR-024'], method: 'Test',
  steps: ['Script a match: you miss three, the CPU scores three.', 'Script a second match: you score four, the CPU scores one then misses two.'],
  expected: ['First match: "You lose", 3–0, three kicks each.', 'Second match: ends as soon as it is decided, after your fourth kick and the CPU\'s third; "You win", 4–1.'],
  async run(b) {
    const p = await open(b); await startPaused(p);
    const a = await p.evaluate(() => __h.match([0, 0, 0], [1, 1, 1]));
    ok(a.title === 'You lose' && /3–0/.test(a.text) && a.you.length === 3 && a.cpu.length === 3, a.title + ' | ' + a.text);
    await p.click('#go');
    const c = await p.evaluate(() => __h.match([1, 1, 1, 1, 1], [1, 0, 0, 0, 0]));
    ok(c.title === 'You win' && /4–1/.test(c.text) && c.you.length === 4 && c.cpu.length === 3, `${c.title} | ${c.text} | ${c.you.length}/${c.cpu.length}`);
    return `"${a.title}" "${a.text}"; then "${c.title}" "${c.text}" (${c.you.length} v ${c.cpu.length} kicks)`;
  } },

{ id: 'SVC-008', title: 'Flick target mapping', verifies: ['SWR-006', 'SWR-007'], method: 'Test',
  steps: ['Start a match at 1100×650 and wait for the aim state.', 'Press at (550, 500) and drag to (610, 350) without releasing.',
    'Read the aim marker position.'],
  expected: ['Reference length is min(650, 1.6 × 1100) = 650 px.', 'Marker is visible at x = 15 × 60/650 = 1.385 m, y = 7.5 × 150/650 − 0.35 = 1.381 m (± 0.01 m).'],
  async run(b) {
    const p = await open(b); await startLive(p);
    await drag(p, [[550, 500], [570, 450], [590, 400], [610, 350]]);
    const r = await p.evaluate(() => { const q = __twelveYards.reticle; return { v: q.visible, x: q.position.x, y: q.position.y }; });
    await p.mouse.up();
    ok(r.v, 'marker not visible'); near(r.x, 15 * 60 / 650, 0.01, 'x'); near(r.y, 7.5 * 150 / 650 - 0.35, 0.01, 'y');
    return `marker at (${r.x.toFixed(3)}, ${r.y.toFixed(3)}) m`;
  } },

{ id: 'SVC-009', title: 'Flick acceptance', verifies: ['SWR-006'], method: 'Test',
  steps: ['In the aim state, drag 100 px downward and release.', 'Drag 20 px upward (3 % of the reference length) and release.',
    'Drag 150 px upward and release.', 'While the ball is in flight, drag 150 px upward again.'],
  expected: ['The first two drags do not shoot: state stays "aim".', 'The third drag shoots: state becomes "flight".',
    'The fourth drag is ignored: the ball\'s flight is not restarted.'],
  async run(b) {
    const p = await open(b); await startLive(p);
    await drag(p, [[550, 400], [550, 450], [550, 500]]); await p.mouse.up();
    const s1 = await p.evaluate(() => __twelveYards.S.state);
    await drag(p, [[550, 500], [550, 490], [550, 480]]); await p.mouse.up();
    const s2 = await p.evaluate(() => __twelveYards.S.state);
    await drag(p, [[550, 500], [550, 420], [550, 350]]); await p.mouse.up();
    const s3 = await p.evaluate(() => ({ s: __twelveYards.S.state, z: __twelveYards.ball.position.z }));
    await p.waitForTimeout(150);
    await drag(p, [[550, 500], [550, 420], [550, 350]]); await p.mouse.up();
    const s4 = await p.evaluate(() => ({ s: __twelveYards.S.state, z: __twelveYards.ball.position.z }));
    ok(s1 === 'aim' && s2 === 'aim', `rejected drags left state ${s1}, ${s2}`);
    ok(s3.s === 'flight', 'valid drag gave state ' + s3.s);
    ok(s4.s !== 'aim' && s4.z < s3.z, `second drag in flight: state ${s4.s}, z ${s3.z}→${s4.z}`);
    return `down-drag→${s1}; 20 px→${s2}; 150 px→${s3.s}; drag during flight ignored (ball z ${f2(s3.z)}→${f2(s4.z)} m)`;
  } },

{ id: 'SVC-010', title: 'Flick speed sets shot power', verifies: ['SWR-008'], method: 'Test',
  steps: ['Record the time of each pointer move made on the canvas while the button is held.',
    'Drag (550, 500)→(610, 350) in two pointer moves, as fast as the input driver allows, and release; compute flight time as 11 m ÷ forward speed.',
    'Reset to the aim state and repeat the same drag in ten moves over about 0.7 s or more.',
    'Reset; dispatch the same flick as pointer events within one millisecond.'],
  expected: ['For both real drags the flight time equals the specified formula applied to the recorded drag: v = (path ÷ 650 px) ÷ duration, p = clamp((v − 0.35) ÷ 1.55, 0, 1), T = 1.05 − 0.63 p (± 0.01 s).',
    'The fast drag gives a shorter flight time than the slow drag; the slow drag gives more than 0.90 s.',
    'The instantaneous flick gives 0.42 s (full power).'],
  async run(b) {
    const p = await open(b); await startLive(p);
    await p.evaluate(() => { window.__mv = []; document.getElementById('gl').addEventListener('pointermove', e => { if (e.buttons & 1) window.__mv.push(performance.now()); }); });
    const model = async len => { const mv = await p.evaluate(() => { const m = window.__mv; window.__mv = []; return m; });
      const dur = Math.max(0.05, (mv[mv.length - 1] - (mv[0] - 16)) / 1000), v = (len / 650) / dur;
      return { dur, T: 1.05 - 0.63 * Math.max(0, Math.min(1, (v - 0.35) / 1.55)) }; };
    const len = 2 * Math.hypot(30, 75);
    await drag(p, [[550, 500], [580, 425], [610, 350]]); await p.mouse.up();
    const tf = await p.evaluate(() => 11 / Math.abs(__twelveYards.vel.z)); const mf = await model(len);
    await rearm(p);
    const pts = []; for (let i = 0; i <= 10; i++) pts.push([550 + i * 6, 500 - i * 15]);
    await drag(p, pts, 70); await p.mouse.up();
    const ts = await p.evaluate(() => 11 / Math.abs(__twelveYards.vel.z)); const ms = await model(10 * Math.hypot(6, 15));
    await rearm(p);
    const ti = await p.evaluate(() => { const c = document.getElementById('gl');
      const ev = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: 1, pointerType: 'mouse', clientX: x, clientY: y, bubbles: true }));
      ev('pointerdown', 550, 500); ev('pointermove', 580, 425); ev('pointermove', 610, 350); ev('pointerup', 610, 350);
      return 11 / Math.abs(__twelveYards.vel.z); });
    near(tf, mf.T, 0.01, 'fast drag flight time vs formula'); near(ts, ms.T, 0.01, 'slow drag flight time vs formula');
    ok(tf < ts && ts > 0.9, `fast ${tf} s, slow ${ts} s`); near(ti, 0.42, 0.001, 'instantaneous flick');
    return `fast drag (${mf.dur.toFixed(3)} s): T=${tf.toFixed(3)} s, formula ${mf.T.toFixed(3)} s; slow drag (${ms.dur.toFixed(3)} s): T=${ts.toFixed(3)} s, formula ${ms.T.toFixed(3)} s; instantaneous flick T=${ti.toFixed(3)} s`;
  } },

{ id: 'SVC-011', title: 'Bent flick curls the ball', verifies: ['SWR-009'], method: 'Test',
  steps: ['Drag straight up (550, 500)→(550, 350), release, read the lateral acceleration.',
    'Reset; drag (550, 500)→(600, 425)→(550, 350), a 50 px bulge to the right, release, read the lateral acceleration.',
    'Reset; drag with a 200 px bulge to the left.'],
  expected: ['Straight flick: 0 m/s².', 'Right bulge of 50 px: −110 × 50/650 = −8.46 m/s² (± 0.05).', 'Large left bulge: limited to +9 m/s².'],
  async run(b) {
    const p = await open(b); await startLive(p);
    await drag(p, [[550, 500], [550, 425], [550, 350]]); await p.mouse.up();
    const a0 = await p.evaluate(() => __twelveYards.fl.ax);
    await rearm(p); await drag(p, [[550, 500], [600, 425], [550, 350]]); await p.mouse.up();
    const a1 = await p.evaluate(() => __twelveYards.fl.ax);
    await rearm(p); await drag(p, [[550, 500], [350, 425], [550, 350]]); await p.mouse.up();
    const a2 = await p.evaluate(() => __twelveYards.fl.ax);
    near(a0, 0, 1e-6, 'straight'); near(a1, -110 * 50 / 650, 0.05, 'right bulge'); near(a2, 9, 1e-6, 'left bulge clamp');
    return `straight ${a0.toFixed(2)}; right bulge ${a1.toFixed(2)}; large left bulge ${a2.toFixed(2)} m/s²`;
  } },

{ id: 'SVC-012', title: 'Touch-type pointer input (emulated)', verifies: ['SWR-006'], method: 'Test',
  steps: ['In the aim state, dispatch pointerdown, pointermove and pointerup events of pointerType "touch" on the canvas describing a 150 px upward flick.'],
  expected: ['The flick shoots: state becomes "flight".'],
  async run(b) {
    const p = await open(b); await startLive(p);
    const s = await p.evaluate(() => { const c = document.getElementById('gl');
      const ev = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true }));
      ev('pointerdown', 550, 500); ev('pointermove', 560, 430); ev('pointermove', 570, 350); ev('pointerup', 570, 350);
      return __twelveYards.S.state; });
    ok(s === 'flight', 'state ' + s); return `state after emulated touch flick: ${s}`;
  } },

{ id: 'SVC-013', title: 'Launch reaches the aimed point', verifies: ['SWR-010'], method: 'Test',
  steps: ['With collisions disabled, launch the ball at each (x, y, flight time, curl): (0, 1.2, 0.42, 0), (3.3, 2.2, 0.5, 0), (−3.3, 0.3, 0.8, 0), (2, 1, 1.05, 0), (2.5, 1.5, 0.6, 6), (−3, 2, 0.45, −9).',
    'Step the simulation at 240 Hz and record where and when the ball crosses the goal line.'],
  expected: ['Crossing point within 0.10 m of the aimed point in x and y for every launch.', 'Crossing time within 0.02 s of the requested flight time.'],
  async run(b) {
    const p = await open(b); await pause(p);
    const L = [[0, 1.2, 0.42, 0], [3.3, 2.2, 0.5, 0], [-3.3, 0.3, 0.8, 0], [2, 1, 1.05, 0], [2.5, 1.5, 0.6, 6], [-3, 2, 0.45, -9]];
    const got = await p.evaluate(L => L.map(l => { const t = __twelveYards; t.resetBall(); t.launch(l[0], l[1], l[2], l[3]); t.S.state = 'test';
      let n = 0, x0, y0, z0; const q = t.ball.position;
      do { x0 = q.x; y0 = q.y; z0 = q.z; t.stepBall(1 / 240); n++; } while (q.z > 0 && n < 2000);
      const f = z0 / (z0 - q.z); return { x: x0 + (q.x - x0) * f, y: y0 + (q.y - y0) * f, time: (n - 1 + f) / 240 }; }), L);
    let worst = 0, worstT = 0;
    got.forEach((g, i) => { const e = Math.max(Math.abs(g.x - L[i][0]), Math.abs(g.y - L[i][1])); worst = Math.max(worst, e);
      worstT = Math.max(worstT, Math.abs(g.time - L[i][2]));
      ok(e <= 0.10, `launch ${i + 1}: position error ${e.toFixed(3)} m`); ok(Math.abs(g.time - L[i][2]) <= 0.02, `launch ${i + 1}: time ${g.time}`); });
    return `6 launches; worst position error ${worst.toFixed(3)} m; worst time error ${worstT.toFixed(4)} s`;
  } },

{ id: 'SVC-014', title: 'Goal detection and banner', verifies: ['SWR-011', 'SWR-021', 'SWR-030'], method: 'Test',
  steps: ['Player kick aimed at (2.0, 1.0) with the keeper standing at x = −3.', 'Continue the simulation for 3 s after the goal.',
    'CPU kick aimed at (2.0, 1.0) with the gloves at (−3, 0.5).'],
  expected: ['Player kick: exactly one result recorded, a goal; banner "Goal!" with the launch speed × 3.6 rounded, in km/h.',
    'Afterwards the ball stays inside the net (z ≥ −1.85 m, |x| ≤ 3.66 m, y ≤ 2.44 m).', 'CPU kick: a goal; banner "They score".'],
  async run(b) {
    const p = await open(b); await startPaused(p);
    const r = await p.evaluate(() => { const t = __twelveYards; const k = __h.kick('you', 2, 1, 0.5, 0, { x: -3, y: 2.25 });
      let inside = true; for (let i = 0; i < 720; i++) { t.stepBall(1 / 240); const q = t.ball.position;
        if (q.z < -1.85 - 1e-6 || Math.abs(q.x) > 3.66 || q.y > 2.44) inside = false; }
      return { k, inside, z: t.ball.position.z }; });
    const c = await p.evaluate(() => __h.kick('cpu', 2, 1, 0.5, 0, { x: -3, y: 0.5 }));
    ok(r.k.recorded === 1 && r.k.goal === true && r.k.inNet, 'player kick ' + JSON.stringify(r.k));
    ok(r.k.banner === 'Goal!' && r.k.sub === Math.round(r.k.speed * 3.6) + ' km/h', `banner "${r.k.banner}" "${r.k.sub}"`);
    ok(r.inside, 'ball left the net'); ok(c.goal === true && c.banner === 'They score', 'cpu kick ' + JSON.stringify(c));
    return `player: goal, banner "${r.k.banner}" "${r.k.sub}", ball at rest z=${f2(r.z)} m inside net; CPU: goal, banner "${c.banner}"`;
  } },

{ id: 'SVC-015', title: 'Woodwork', verifies: ['SWR-012', 'SWR-021'], method: 'Test',
  steps: ['Player kick aimed at the right post (3.66, 1.0), keeper away.', 'Player kick aimed at the crossbar (0, 2.44), keeper away.'],
  expected: ['Both: one result recorded, not a goal; ball rebounds toward the pitch (forward speed reversed).', 'Banners "Off the post" and "Off the bar".'],
  async run(b) {
    const p = await open(b); await startPaused(p);
    const a = await p.evaluate(() => __h.kick('you', 3.66, 1.0, 0.5, 0, { x: -3, y: 2.25 }));
    const c = await p.evaluate(() => __h.kick('you', 0, 2.44, 0.5, 0, { x: -3, y: 2.25 }));
    ok(a.recorded === 1 && a.goal === false && a.vz > 0 && a.banner === 'Off the post', 'post ' + JSON.stringify(a));
    ok(c.recorded === 1 && c.goal === false && c.vz > 0 && c.banner === 'Off the bar', 'bar ' + JSON.stringify(c));
    return `post: no goal, "${a.banner}", rebound ${f2(a.vz)} m/s; bar: no goal, "${c.banner}", rebound ${f2(c.vz)} m/s`;
  } },

{ id: 'SVC-016', title: 'Off-target shots', verifies: ['SWR-013', 'SWR-021'], method: 'Test',
  steps: ['Player kick aimed wide at (4.5, 1.0).', 'Player kick aimed over at (0, 3.2).', 'CPU kick aimed wide at (4.5, 1.0).'],
  expected: ['None is a goal.', 'Banners "Wide", "Over the bar", and for the CPU "Wide" with "They miss".'],
  async run(b) {
    const p = await open(b); await startPaused(p);
    const a = await p.evaluate(() => __h.kick('you', 4.5, 1.0, 0.5, 0, { x: -3, y: 2.25 }));
    const c = await p.evaluate(() => __h.kick('you', 0, 3.2, 0.5, 0, { x: -3, y: 2.25 }));
    const d = await p.evaluate(() => __h.kick('cpu', 4.5, 1.0, 0.5, 0, { x: -3, y: 0.5 }));
    ok(a.goal === false && a.banner === 'Wide', JSON.stringify(a)); ok(c.goal === false && c.banner === 'Over the bar', JSON.stringify(c));
    ok(d.goal === false && d.banner === 'Wide' && d.sub === 'They miss', JSON.stringify(d));
    return `"${a.banner}", "${c.banner}", CPU "${d.banner}" / "${d.sub}"; no goals`;
  } },

{ id: 'SVC-017', title: 'Saves', verifies: ['SWR-014', 'SWR-021'], method: 'Test',
  steps: ['Player kick at (1.2, 1.1) with the keeper\'s hands at (1.0, 1.0): 0.22 m from the ball.',
    'Player kick at (1.0, 0.4) with the keeper standing at x = 1.3 and hands at 2.25 m: 0.30 m from the body, 1.87 m from the hands.',
    'Player kick at (1.75, 1.0) with the keeper\'s hands at (1.0, 1.0): 0.75 m away.',
    'CPU kick at (−1.8, 1.4) with the gloves at (−2.0, 1.5): 0.22 m away.', 'CPU kick at (−1.8, 1.4) with the gloves at (−1.1, 1.4): 0.70 m away.'],
  expected: ['Kicks 1, 2 and 4 are saved: no goal, ball deflected back toward the pitch; banners "Saved", "Saved", "What a save!".',
    'Kicks 3 and 5 are goals.'],
  async run(b) {
    const p = await open(b); await startPaused(p);
    const k = await p.evaluate(() => [
      __h.kick('you', 1.2, 1.1, 0.5, 0, { x: 1.0, y: 1.0 }), __h.kick('you', 1.0, 0.4, 0.5, 0, { x: 1.3, y: 2.25 }),
      __h.kick('you', 1.75, 1.0, 0.5, 0, { x: 1.0, y: 1.0 }), __h.kick('cpu', -1.8, 1.4, 0.5, 0, { x: -2.0, y: 1.5 }),
      __h.kick('cpu', -1.8, 1.4, 0.5, 0, { x: -1.1, y: 1.4 })]);
    ok(k[0].goal === false && k[0].banner === 'Saved' && k[0].vz > 0, 'hand save ' + JSON.stringify(k[0]));
    ok(k[1].goal === false && k[1].banner === 'Saved', 'body save ' + JSON.stringify(k[1]));
    ok(k[2].goal === true, 'out of reach ' + JSON.stringify(k[2]));
    ok(k[3].goal === false && k[3].banner === 'What a save!' && k[3].vz > 0, 'glove save ' + JSON.stringify(k[3]));
    ok(k[4].goal === true, 'gloves out of reach ' + JSON.stringify(k[4]));
    return `results: ${k.map(x => x.goal ? 'goal' : 'saved').join(', ')}; banners "${k[0].banner}", "${k[3].banner}"`;
  } },

{ id: 'SVC-018', title: 'One result per kick and turn hand-over delay', verifies: ['SWR-003', 'SWR-022'], method: 'Test',
  steps: ['Take a player kick that scores.', 'Advance the game clock in 1/60 s steps until the turn changes.'],
  expected: ['Exactly one result is recorded for the kick.', 'The turn passes to the CPU 2.1 s (± 0.05 s) after the result.'],
  async run(b) {
    const p = await open(b); await startPaused(p);
    const r = await p.evaluate(() => { const t = __twelveYards; const k = __h.kick('you', 2, 1, 0.5, 0, { x: -3, y: 2.25 });
      let n = 0; while (t.S.turn === 'you' && n < 600) { t.tick(1 / 60); n++; }
      return { rec: k.recorded, secs: n / 60, turn: t.S.turn, you: t.S.you.length }; });
    ok(r.rec === 1 && r.you === 1, 'results recorded ' + r.rec); ok(r.turn === 'cpu', 'turn ' + r.turn); near(r.secs, 2.1, 0.05, 'delay');
    return `1 result; turn→${r.turn} after ${r.secs.toFixed(2)} s`;
  } },

{ id: 'SVC-019', title: 'CPU goalkeeper reaction and speed', verifies: ['SWR-015'], method: 'Test',
  steps: ['With 0, 5 and 12 player kicks already taken, take a full-power player shot at (3.3, 2.2) and read the keeper\'s reaction delay.',
    'For the first shot, step the game at 120 Hz and record the keeper\'s hand movement per step.'],
  expected: ['Reaction delay = max(0.15, 0.235 − 0.008 × kicks taken): 0.235 s, 0.195 s, 0.150 s.',
    'Hands do not move before the delay elapses.', 'After it, hand speed never exceeds 5.6 m/s.'],
  async run(b) {
    const p = await open(b); await startPaused(p);
    const r = await p.evaluate(() => { const t = __twelveYards, rds = []; let early = 0, vmax = 0;
      [0, 5, 12].forEach((n, i) => { t.beginTurn('you'); t.clearTimers(); t.S.you = new Array(n).fill(true); t.S.state = 'aim';
        t.tick(0); t.playerShoot({ tx: 3.3, ty: 2.2, power: 1, curve: 0 }); rds.push(t.K.rd);
        if (i === 0) for (let s = 0; s < 120; s++) { const x = t.K.P.x, y = t.K.P.y, before = t.fl.t; t.tick(1 / 120);
          const d = Math.hypot(t.K.P.x - x, t.K.P.y - y); if (before + 1 / 120 <= t.K.rd) early = Math.max(early, d); vmax = Math.max(vmax, d * 120); } });
      return { rds, early, vmax }; });
    near(r.rds[0], 0.235, 1e-9, 'delay n=0'); near(r.rds[1], 0.195, 1e-9, 'delay n=5'); near(r.rds[2], 0.15, 1e-9, 'delay n=12');
    ok(r.early === 0, 'moved before delay by ' + r.early); ok(r.vmax <= 5.6 + 1e-6 && r.vmax > 5, 'hand speed ' + r.vmax);
    return `delays ${r.rds.map(x => x.toFixed(3)).join(', ')} s; no movement before delay; peak hand speed ${r.vmax.toFixed(2)} m/s`;
  } },

{ id: 'SVC-020', title: 'Glove steering', verifies: ['SWR-016'], method: 'Test',
  steps: ['Start the CPU\'s turn and hold it before the run-up.', 'Move the pointer to (300, 300) and wait 1 s.',
    'Move the pointer to the far screen corner (1095, 5); 120 ms later read how far the gloves moved; wait 1.5 s and read the glove position.'],
  expected: ['After the first move the gloves sit on the pointer\'s point in the goal plane.', 'Glove travel in the 120 ms window corresponds to at most 9 m/s.',
    'At the corner the gloves stop at the limits |x| = 3.9 m, y = 2.75 m.'],
  async run(b) {
    const p = await open(b); await startLive(p);
    await p.evaluate(() => { const t = __twelveYards; t.beginTurn('cpu'); t.clearTimers(); });
    await p.waitForTimeout(1500);                       // let the camera settle behind the goal
    await p.mouse.move(300, 300); await p.waitForTimeout(1000);
    const a = await p.evaluate(() => { const g = __twelveYards.GL; return { px: g.P.x, py: g.P.y, tx: g.T.x, ty: g.T.y }; });
    await p.mouse.move(1095, 5);
    const s0 = await p.evaluate(() => { const g = __twelveYards.GL; return { x: g.P.x, y: g.P.y, t: performance.now() }; });
    await p.waitForTimeout(120);
    const s1 = await p.evaluate(() => { const g = __twelveYards.GL; return { x: g.P.x, y: g.P.y, t: performance.now() }; });
    await p.waitForTimeout(1500);
    const e = await p.evaluate(() => { const g = __twelveYards.GL; return { x: g.P.x, y: g.P.y }; });
    const speed = Math.hypot(s1.x - s0.x, s1.y - s0.y) / ((s1.t - s0.t) / 1000);
    near(a.px, a.tx, 1e-6, 'glove x on target'); near(a.py, a.ty, 1e-6, 'glove y on target');
    ok(speed <= 9 * 1.05 && speed > 0, 'glove speed ' + speed);
    near(Math.abs(e.x), 3.9, 1e-6, 'x limit'); near(e.y, 2.75, 1e-6, 'y limit');
    return `gloves reached pointer point (${f2(a.px)}, ${f2(a.py)}) m; measured speed ${speed.toFixed(2)} m/s; corner clamp (${f2(e.x)}, ${f2(e.y)}) m`;
  } },

{ id: 'SVC-021', title: 'CPU kick sequence', verifies: ['SWR-017'], method: 'Test',
  steps: ['Start the CPU\'s turn five times in real time.', 'Each time wait for the run-up and then the kick; read the ball\'s forward speed and curl, and which figures are shown.'],
  expected: ['State goes wait → run-up → flight without input.', 'Flight time 11 m ÷ forward speed is between 0.50 s and 0.74 s; |curl| ≤ 6 m/s².',
    'The kicker and the gloves are shown; the CPU goalkeeper is hidden.'],
  async run(b) {
    const p = await open(b); await startLive(p); const Ts = [], axs = [];
    for (let i = 0; i < 5; i++) {
      await p.evaluate(() => { __twelveYards.clearTimers(); __twelveYards.beginTurn('cpu'); });
      await p.waitForFunction(() => __twelveYards.S.state === 'runup', null, { timeout: 15000 });
      await p.waitForFunction(() => __twelveYards.S.state !== 'runup', null, { timeout: 15000 });
      const r = await p.evaluate(() => { const t = __twelveYards; return { s: t.S.state, vz: t.vel.z, ax: t.fl.ax, n: t.S.cpu.length }; });
      ok(r.s === 'flight' || r.s === 'result', 'state after run-up ' + r.s);
      await p.waitForFunction(() => __twelveYards.fl.done, null, { timeout: 15000 });
      if (r.s === 'flight') { const T = 11 / Math.abs(r.vz); Ts.push(T); axs.push(Math.abs(r.ax));
        ok(T >= 0.50 - 1e-6 && T <= 0.74 + 1e-6, 'flight time ' + T); ok(Math.abs(r.ax) <= 6, 'curl ' + r.ax); }
    }
    ok(Ts.length >= 3, 'too few kicks sampled in flight: ' + Ts.length);
    const vis = await p.evaluate(() => { const f = __twelveYards.figures; return { kicker: f.kicker.visible, gloves: f.gloves.visible, keeper: f.keeper.visible }; });
    ok(vis.kicker && vis.gloves && !vis.keeper, 'figures ' + JSON.stringify(vis));
    return `${Ts.length} kicks sampled; flight times ${Math.min(...Ts).toFixed(2)}–${Math.max(...Ts).toFixed(2)} s; max |curl| ${Math.max(...axs).toFixed(2)} m/s²; kicker and gloves shown, CPU keeper hidden`;
  } },

{ id: 'SVC-022', title: 'Sound control', verifies: ['SWR-025'], method: 'Test',
  steps: ['Before starting, read whether an audio context exists.', 'Press "Kick off"; read it again.', 'Press the sound button twice, reading its label, pressed state and the master gain each time.'],
  expected: ['No audio context before the first button press; one exists after "Kick off" with gain 1.',
    'First press: label "Sound off", aria-pressed "true", gain 0.', 'Second press: label "Sound on", aria-pressed "false", gain 1.'],
  async run(b) {
    const p = await open(b);
    const rd = () => p.evaluate(() => { const m = document.getElementById('mute'); const a = __twelveYards.audio();
      return { started: a.started, gain: a.gain, label: m.textContent, pressed: m.getAttribute('aria-pressed') }; });
    const a = await rd(); await p.click('#go'); const c = await rd();
    await p.click('#mute'); const d = await rd(); await p.click('#mute'); const e = await rd();
    ok(a.started === false, 'audio existed before start'); ok(c.started === true && c.gain === 1, 'after start ' + JSON.stringify(c));
    ok(d.label === 'Sound off' && d.pressed === 'true' && d.gain === 0, 'muted ' + JSON.stringify(d));
    ok(e.label === 'Sound on' && e.pressed === 'false' && e.gain === 1, 'unmuted ' + JSON.stringify(e));
    return `context before start: no; after: yes; mute → "${d.label}", gain ${d.gain}; unmute → "${e.label}", gain ${e.gain}`;
  } },

{ id: 'SVC-023', title: 'Goal stays in view at each screen shape', verifies: ['SWR-026'], method: 'Test',
  steps: ['For viewports 1100×650, 390×844 (phone portrait) and 844×390 (phone landscape): start a match, select the shooting camera and then the goalkeeping camera.',
    'Project the four corners of the goal mouth to the screen in each view.', 'Measure the page width against the viewport width.'],
  expected: ['All four goal corners lie inside the viewport in both views at all three sizes.', 'The page is not wider than the viewport (no horizontal scrolling).'],
  async run(b) {
    const out = [];
    for (const vp of [{ width: 1100, height: 650 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
      const p = await open(b, { viewport: vp }); await startPaused(p);
      const r = await p.evaluate(() => { const t = __twelveYards, res = {};
        for (const m of ['shoot', 'keep']) { t.setCam(m, true); t.tick(0); t.camera.updateMatrixWorld(true);
          res[m] = Math.max(...[[-3.66, 0], [3.66, 0], [-3.66, 2.44], [3.66, 2.44]].map(c => { const v = new THREE.Vector3(c[0], c[1], 0).project(t.camera);
            return Math.max(Math.abs(v.x), Math.abs(v.y)); })); }
        return { res, sw: document.documentElement.scrollWidth, iw: innerWidth }; });
      ok(r.res.shoot < 1 && r.res.keep < 1, `${vp.width}×${vp.height}: corner extent shoot ${r.res.shoot}, keep ${r.res.keep}`);
      ok(r.sw <= r.iw, `${vp.width}×${vp.height}: page width ${r.sw} > ${r.iw}`);
      out.push(`${vp.width}×${vp.height}: ${f2(r.res.shoot)}/${f2(r.res.keep)}`);
      await p.context().close();
    }
    return `largest corner offset from screen centre, as a fraction of the half-screen (shoot/keep): ${out.join('; ')}; no horizontal overflow`;
  } },

{ id: 'SVC-024', title: '3D unavailable', verifies: ['SWR-027'], method: 'Test',
  steps: ['Open the page with the three.js request blocked.'],
  expected: ['A message stating that WebGL is needed is shown.', 'The start overlay is hidden, so the game cannot be started.'],
  async run(b) {
    const p = await open(b, { blockThree: true });
    const r = await p.evaluate(() => ({ fail: !document.getElementById('fail').hidden, text: document.getElementById('fail').textContent,
      ov: document.getElementById('overlay').hidden }));
    ok(r.fail && /WebGL/.test(r.text) && r.ov, JSON.stringify(r)); return `message shown: "${r.text}"; start overlay hidden`;
  } },

{ id: 'SVC-025', title: 'Reduced motion', verifies: ['SWR-028'], method: 'Test',
  steps: ['Open the page with the reduced-motion preference on; sample the camera\'s sideways position on the start screen over 1.2 s; score a goal and read the banner animation.',
    'Repeat with the preference off.'],
  expected: ['Preference on: camera stays at x = 0 and the banner has no animation.', 'Preference off: camera drifts sideways and the banner uses the "pop" animation.'],
  async run(b) {
    const res = {};
    for (const rm of ['reduce', 'no-preference']) {
      const p = await open(b, { reducedMotion: rm }); await p.waitForTimeout(1200);
      const x = await p.evaluate(() => __twelveYards.camera.position.x);
      await startPaused(p);
      const anim = await p.evaluate(() => { __h.kick('you', 2, 1, 0.5, 0, { x: -3, y: 2.25 }); return getComputedStyle(document.getElementById('banner')).animationName; });
      res[rm] = { x, anim }; await p.context().close();
    }
    ok(res.reduce.x === 0 && res.reduce.anim === 'none', 'reduce ' + JSON.stringify(res.reduce));
    ok(Math.abs(res['no-preference'].x) > 0.02 && res['no-preference'].anim === 'pop', 'default ' + JSON.stringify(res['no-preference']));
    return `on: camera x=${res.reduce.x}, animation ${res.reduce.anim}; off: camera x=${f2(res['no-preference'].x)}, animation ${res['no-preference'].anim}`;
  } },

{ id: 'SVC-026', title: 'No stored data, no other network use (run time)', verifies: ['SWR-029'], method: 'Test',
  steps: ['Open the page, start a match, take a kick and let the CPU take one.', 'List every network request the page made, and read the page\'s local storage, session storage and cookies.'],
  expected: ['Requests go only to the page itself, cdnjs.cloudflare.com (three.js) and fonts.googleapis.com / fonts.gstatic.com.', 'Storage and cookies are empty.'],
  async run(b) {
    const p = await open(b); await startLive(p);
    await drag(p, [[550, 500], [560, 420], [570, 350]]); await p.mouse.up();
    await p.waitForFunction(() => __twelveYards.S.cpu.length === 1, null, { timeout: 30000 });
    const st = await p.evaluate(() => ({ ls: localStorage.length, ss: sessionStorage.length, ck: document.cookie }));
    const hosts = [...new Set(p.requests.map(u => u.startsWith('file:') ? 'file' : new URL(u).host))];
    const allowed = ['file', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
    ok(hosts.every(h => allowed.includes(h)), 'hosts ' + hosts.join(', '));
    ok(st.ls === 0 && st.ss === 0 && st.ck === '', JSON.stringify(st));
    return `request hosts: ${hosts.join(', ')}; localStorage ${st.ls}, sessionStorage ${st.ss}, cookies empty`;
  } },

{ id: 'SVC-027', title: 'Single file and external references (inspection)', verifies: ['SWR-001', 'SWR-029', 'SWR-031'], method: 'Inspection (automated)',
  steps: ['Scan index.html for every http(s) URL and for use of storage or network APIs.', 'Check the verification interface is the only global the game defines.'],
  expected: ['The only URLs are the three.js r128 script on cdnjs and the Google Fonts stylesheet.',
    'No use of localStorage, sessionStorage, document.cookie, fetch, XMLHttpRequest, WebSocket or sendBeacon.',
    'The game assigns exactly one global, window.__twelveYards.'],
  async run() {
    const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const urls = [...new Set(src.match(/https?:\/\/[^\s"'<>)]+/g) || [])];
    ok(urls.length === 2 && urls.some(u => u === 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js') &&
      urls.some(u => u.startsWith('https://fonts.googleapis.com/css2?')), 'urls ' + urls.join(' '));
    const bad = ['localStorage', 'sessionStorage', 'document.cookie', 'fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon'].filter(k => src.includes(k));
    ok(bad.length === 0, 'found ' + bad.join(', '));
    const globals = [...new Set(src.match(/window\.[A-Za-z_$][\w$]*\s*=(?!=)/g) || [])];
    ok(globals.length === 1 && /__twelveYards/.test(globals[0]), 'globals ' + globals.join(' '));
    return `${urls.length} external URLs (three.js r128 on cdnjs, Google Fonts); no storage/network APIs; 1 global`;
  } },

{ id: 'SVC-028', title: 'Ground bounce', verifies: ['SWR-030'], method: 'Test',
  steps: ['With collisions disabled, drop the ball from 1 m at rest and step at 240 Hz until it rebounds.'],
  expected: ['Upward speed after the bounce is 0.45 × the downward speed before it (± 0.02).', 'The ball never goes below its radius (0.11 m).'],
  async run(b) {
    const p = await open(b); await pause(p);
    const r = await p.evaluate(() => { const t = __twelveYards; t.resetBall(); t.S.state = 'test'; t.ball.position.set(0, 1, 5); t.vel.set(0, 0, 0);
      let prev = 0, minY = 9, n = 0; while (n++ < 2000) { prev = t.vel.y; t.stepBall(1 / 240); minY = Math.min(minY, t.ball.position.y); if (prev < 0 && t.vel.y > 0) break; }
      return { ratio: t.vel.y / Math.abs(prev), minY }; });
    near(r.ratio, 0.45, 0.02, 'restitution'); ok(r.minY >= 0.11 - 1e-9, 'min height ' + r.minY);
    return `rebound ratio ${r.ratio.toFixed(3)}; lowest ball centre ${r.minY.toFixed(3)} m`;
  } },

{ id: 'SVC-029', title: 'Sound is audible and appropriate', verifies: ['SWR-025'], method: 'Manual',
  steps: ['Play a match with speakers on.', 'Listen for the whistle before each kick, the kick, the crowd reaction to goals and saves, and the woodwork sound.', 'Mute and confirm silence.'],
  expected: ['Each event produces its sound; nothing plays while muted.'] },

{ id: 'SVC-030', title: 'Play on a physical phone', verifies: ['SWR-006', 'SWR-016', 'SWR-026'], method: 'Manual',
  steps: ['Open the game on an iOS and an Android phone, in portrait and landscape.', 'Play a full match using touch only.'],
  expected: ['Flicks shoot, the gloves follow the finger, the page does not scroll or zoom while playing, and all HUD text is readable.'] },

{ id: 'SVC-031', title: 'Frame rate on target devices', verifies: ['SWR-001'], method: 'Manual',
  steps: ['Play on a mid-range phone and a laptop with integrated graphics; observe frame rate with the browser\'s performance tools.'],
  expected: ['Play stays at or above 30 frames per second.'] },
];

/* ------------------------------------------------------------------ */
function swrIds() {
  const f = path.join(ROOT, 'docs/02-software-requirements.md');
  if (!fs.existsSync(f)) return [];
  return [...new Set((fs.readFileSync(f, 'utf8').match(/^\| (SWR-\d{3}) /gm) || []).map(s => s.slice(2).trim()))];
}
const li = a => a.map(s => `- ${s}`).join('\n');
const num = a => a.map((s, i) => `${i + 1}. ${s}`).join('\n');
const cell = s => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

function writeCasesDoc() {
  const ids = swrIds();
  let md = `# Software Verification Cases\n\n` +
    `Product: Twelve Yards (3D penalty shootout game)\n\n` +
    `This file is generated from \`tests/run-verification.js\`; edit the cases there and run \`npm run verify\`.\n\n` +
    `Each case verifies one or more software requirements from [02-software-requirements.md](02-software-requirements.md). ` +
    `Results of the latest run are in [04-software-verification-results.md](04-software-verification-results.md).\n\n` +
    `## Methods\n\n` +
    `- **Test**: executed automatically in headless Chromium by the runner. Cases that set up exact ball, keeper or glove positions do so through the game's verification interface (SWR-031) and step the simulation at a fixed rate, so they are repeatable. Cases that say "drag", "press" or "move the pointer" use real browser input events in real time.\n` +
    `- **Inspection (automated)**: the runner scans the source file.\n` +
    `- **Manual**: needs a person and real hardware; not executed by the runner.\n\n` +
    `Coordinates: x is metres right of the goal centre as the kicker sees it, y is metres above the ground, at the goal line. Screen positions are CSS pixels in a 1100×650 viewport unless stated.\n\n` +
    `## Cases\n\n`;
  for (const c of CASES) {
    md += `### ${c.id} ${c.title}\n\n- Verifies: ${c.verifies.join(', ')}\n- Method: ${c.method}\n\n**Steps**\n\n${num(c.steps)}\n\n**Expected result**\n\n${li(c.expected)}\n\n`;
  }
  md += `## Coverage of software requirements\n\n| Requirement | Verified by |\n|---|---|\n`;
  for (const id of ids) {
    const by = CASES.filter(c => c.verifies.includes(id)).map(c => c.id + (c.method === 'Manual' ? ' (manual)' : ''));
    md += `| ${id} | ${by.length ? by.join(', ') : '**none**'} |\n`;
  }
  fs.writeFileSync(path.join(ROOT, 'docs/03-software-verification-cases.md'), md);
}

function writeResultsDoc(results, env) {
  const ids = swrIds();
  const n = k => results.filter(r => r.result === k).length;
  let md = `# Software Verification Results\n\n` +
    `Product: Twelve Yards (3D penalty shootout game)\n\n` +
    `This file is generated by \`tests/run-verification.js\` from an actual run; it is not edited by hand. ` +
    `Cases are defined in [03-software-verification-cases.md](03-software-verification-cases.md).\n\n` +
    `## Summary\n\n| | Count |\n|---|---|\n| Cases | ${results.length} |\n| Passed | ${n('Pass')} |\n| Failed | ${n('Fail')} |\n| Not executed (manual) | ${n('Not executed')} |\n\n` +
    `## Run\n\n| | |\n|---|---|\n` +
    `| Date (UTC) | ${env.date} |\n| Item under test | \`index.html\`, SHA-256 \`${env.sha}\` |\n| Repository commit at run time | \`${env.commit}\` |\n` +
    `| Browser | Chromium ${env.browser}, headless, driven by Playwright ${env.playwright} |\n| Graphics | ${env.gl} |\n` +
    `| three.js | r128, ${env.three} |\n| Host | ${env.host} |\n| Duration | ${env.duration} s |\n\n` +
    `## Results by case\n\n| Case | Title | Verifies | Result | Observed |\n|---|---|---|---|---|\n`;
  for (const r of results) md += `| ${r.id} | ${cell(r.title)} | ${r.verifies.join(', ')} | **${r.result}** | ${cell(r.observed)} |\n`;
  md += `\n## Status by software requirement\n\n` +
    `"Verified" means every automated case for the requirement passed. "Partly verified" means the automated cases passed and a manual case is still open.\n\n` +
    `| Requirement | Status | Cases |\n|---|---|---|\n`;
  for (const id of ids) {
    const rs = results.filter(r => r.verifies.includes(id));
    const auto = rs.filter(r => r.result !== 'Not executed');
    let st = 'Not verified';
    if (rs.some(r => r.result === 'Fail')) st = 'Failed';
    else if (auto.length && rs.length === auto.length) st = 'Verified';
    else if (auto.length) st = 'Partly verified';
    md += `| ${id} | ${st} | ${rs.map(r => `${r.id} ${r.result === 'Pass' ? '✓' : r.result === 'Fail' ? '✗' : '–'}`).join(', ') || 'none'} |\n`;
  }
  md += `\n## Limits of this run\n\n` +
    li([
      'One browser engine only: Chromium, headless, with software rendering. Firefox, Safari and real GPUs were not tested.',
      env.three.startsWith('local') ? 'three.js was served from the local npm copy of version 0.128.0 instead of cdnjs, because the test host cannot reach cdnjs. The file content is the same release; the CDN delivery itself was not exercised.' : 'three.js was loaded from cdnjs.',
      'Web fonts could not be downloaded on the test host, so the fallback fonts were in use. Text layout with the intended fonts was not checked.',
      'Touch input was checked with emulated touch-type pointer events only (SVC-012). No physical phone was used (SVC-030).',
      'Sound output was checked only as far as the audio context and master gain (SVC-022). Nobody listened to it (SVC-029).',
      'Frame rate was not measured (SVC-031).',
      'Visual appearance was not verified by these cases.',
      'Outcome cases place the ball, keeper and gloves through the verification interface and step the simulation at a fixed 240 Hz. Behaviour at very low real frame rates was not characterised.',
      'The CPU kicker and keeper use random numbers; SVC-021 sampled five kicks, which checks the limits but not the distribution.',
    ]) + '\n';
  fs.writeFileSync(path.join(ROOT, 'docs/04-software-verification-results.md'), md);
}

(async () => {
  const t0 = Date.now();
  writeCasesDoc();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const only = process.argv.slice(2).filter(a => /^SVC-/.test(a));
  const results = [];
  for (const c of CASES) {
    if (only.length && !only.includes(c.id)) continue;
    let result, observed;
    if (!c.run) { result = 'Not executed'; observed = 'Manual case; needs a person and real hardware.'; }
    else {
      const ctxBefore = browser.contexts().length;
      try { observed = await c.run(browser); result = 'Pass'; }
      catch (e) { result = 'Fail'; observed = String(e.message).split('\n')[0]; }
      for (const ctx of browser.contexts().slice(ctxBefore)) await ctx.close().catch(() => {});
    }
    results.push({ id: c.id, title: c.title, verifies: c.verifies, result, observed });
    console.log(`${result === 'Pass' ? 'PASS' : result === 'Fail' ? 'FAIL' : 'SKIP'}  ${c.id}  ${c.title}\n      ${observed}`);
  }
  // environment
  const pg = await (await browser.newContext()).newPage();
  const gl = await pg.evaluate(() => { const g = document.createElement('canvas').getContext('webgl'); if (!g) return 'no WebGL';
    const x = g.getExtension('WEBGL_debug_renderer_info'); return x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); });
  let commit = 'unknown';
  try { commit = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
    if (execSync('git status --porcelain index.html', { cwd: ROOT }).toString().trim()) commit += ' (index.html modified since this commit)'; } catch (e) {}
  const env = { date: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), commit, gl,
    sha: crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'index.html'))).digest('hex'),
    browser: browser.version(), playwright: require('playwright/package.json').version,
    three: HAS_LOCAL_THREE ? 'local npm copy (three@' + JSON.parse(fs.readFileSync(path.join(path.dirname(THREE_LOCAL), '..', 'package.json'), 'utf8')).version + ')' : 'from cdnjs',
    host: `${os.type()} ${os.release()} ${os.arch()}, Node ${process.version}`, duration: 0 };
  await browser.close();
  env.duration = Math.round((Date.now() - t0) / 1000);
  if (!only.length) writeResultsDoc(results, env);
  const failed = results.filter(r => r.result === 'Fail').length;
  console.log(`\n${results.filter(r => r.result === 'Pass').length} passed, ${failed} failed, ${results.filter(r => r.result === 'Not executed').length} not executed (manual)`);
  process.exit(failed ? 1 : 0);
})();
