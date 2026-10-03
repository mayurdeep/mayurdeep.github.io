// After Leonardo: the Last Supper as a small three-dimensional scene,
// with a ring of synchronized cameras around the table.
import * as THREE from 'three';

const stage = document.getElementById('stage');
const canvas = document.getElementById('view');

let renderer = null;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) {}

if (renderer) build(); else stage.classList.add('fallback');

function build() {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const rnd = mulberry(7);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2a241d');
  const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.05, 80);

  const loader = new THREE.TextureLoader();
  const tex = (url, rx = 1, ry = 1) => {
    const t = loader.load(url, () => { dirty = true; });
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.anisotropy = 4;
    return t;
  };

  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });
  const add = (geo, mat, x = 0, y = 0, z = 0, parent = scene, shadow = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = shadow; m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  /* ───────── the refectory ───────── */
  const W = 10, D = 19, H = 6.4, ZB = -10, ZF = ZB + D;
  // painted surfaces, drawn on canvases rather than photographed
  const paint = (w, h, draw, rx = 1, ry = 1) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4;
    return t;
  };
  const plaster = (base, spread) => paint(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {                                 // soft mottling, like old fresco plaster
      const v = (rnd() - 0.5) * spread;
      g.fillStyle = `rgba(${v > 0 ? '255,250,240' : '60,45,30'},${Math.abs(v) / 255})`;
      const r = 2 + rnd() * 9;
      g.beginPath(); g.arc(rnd() * w, rnd() * h, r, 0, 7); g.fill();
    }
  }, 4, 3);
  const plasterLight = std('#ffffff', { map: plaster('#d8ccb8', 18) });
  const plasterDark = std('#ffffff', { map: plaster('#8e8172', 16) });
  const floorMat = std('#8a7a66');
  const ceilMat = std('#a8987f');

  // floor: worn terracotta tiles drawn on a canvas
  {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d');
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      const v = 120 + Math.random() * 30;
      g.fillStyle = `rgb(${v + 30},${v + 8},${v - 18})`;
      g.fillRect(i * 64, j * 64, 64, 64);
      g.strokeStyle = 'rgba(60,40,25,.35)'; g.lineWidth = 3; g.strokeRect(i * 64, j * 64, 64, 64);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(W / 2, D / 2);
    floorMat.map = t;
  }

  const floor = add(new THREE.PlaneGeometry(W, D), floorMat, 0, 0, ZB + D / 2, scene, false);
  floor.rotation.x = -Math.PI / 2;
  const ceil = add(new THREE.PlaneGeometry(W, D), ceilMat, 0, H, ZB + D / 2, scene, false);
  ceil.rotation.x = Math.PI / 2;
  const back = add(new THREE.PlaneGeometry(W, H), plasterDark, 0, H / 2, ZB, scene, false);
  for (const s of [-1, 1]) {
    const wall = add(new THREE.PlaneGeometry(D, H), plasterLight, s * W / 2, H / 2, ZB + D / 2, scene, false);
    wall.rotation.y = -s * Math.PI / 2;
  }
  // a front wall behind the viewer, so the room is closed when you turn
  const front = add(new THREE.PlaneGeometry(W, H), plasterDark, 0, H / 2, ZF, scene, false);
  front.rotation.y = Math.PI;

  // coffered ceiling: a grid of beams
  const beamMat = std('#6f6253');
  for (let i = 0; i <= 6; i++) add(new THREE.BoxGeometry(W, 0.22, 0.18), beamMat, 0, H - 0.11, ZB + 0.2 + i * 2.6, scene, false);
  for (let i = 0; i <= 5; i++) add(new THREE.BoxGeometry(0.18, 0.22, D), beamMat, -W / 2 + 0.6 + i * (W - 1.2) / 5, H - 0.11, ZB + D / 2, scene, false);
  // cornice where walls meet the ceiling
  add(new THREE.BoxGeometry(W, 0.35, 0.3), beamMat, 0, H - 0.3, ZB + 0.15, scene, false);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.3, 0.35, D), beamMat, s * (W / 2 - 0.15), H - 0.3, ZB + D / 2, scene, false);

  // tapestries and pilasters along the side walls
  const tapTex = tex('assets/tex-tapestry.jpg', 1, 1);
  const tapestry = std('#ffffff', { map: tapTex, emissive: '#ffffff', emissiveMap: tapTex, emissiveIntensity: 0.45 });
  const pilaster = std('#cfc4b2');
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const z = ZB + 1.6 + i * 2.4;
      const t = add(new THREE.PlaneGeometry(1.7, 3.1), tapestry, s * (W / 2 - 0.02), 2.55, z, scene, false);
      t.rotation.y = -s * Math.PI / 2;
      add(new THREE.BoxGeometry(0.16, 4.2, 0.36), pilaster, s * (W / 2 - 0.08), 2.1, z + 1.2, scene, false);
    }
  }

  // three windows in the back wall, opening onto Leonardo's landscape
  // Leonardo's landscape: pale sky, blue distant hills, a darker near ridge
  const sky = new THREE.MeshBasicMaterial({ map: paint(512, 384, (g, w, h) => {
    const s = g.createLinearGradient(0, 0, 0, h * 0.7);
    s.addColorStop(0, '#9fb6cc'); s.addColorStop(1, '#e4e6dc');
    g.fillStyle = s; g.fillRect(0, 0, w, h);
    const ridge = (y0, amp, col, seed) => {
      g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w; x += 4) g.lineTo(x, y0 + amp * Math.sin(x / 70 + seed) + amp * 0.5 * Math.sin(x / 23 + seed * 2));
      g.lineTo(w, h); g.fill();
    };
    ridge(h * 0.62, 14, '#9aaec0', 1); ridge(h * 0.72, 12, '#7f957f', 4); ridge(h * 0.84, 9, '#5f6f4c', 7);
  }) });
  const frameMat = std('#5d5146');
  const windows = [[0, 2.55, 1.7, 1.55], [-2.35, 2.5, 0.95, 1.3], [2.35, 2.5, 0.95, 1.3]];
  for (const [x, y, w, h] of windows) {
    add(new THREE.PlaneGeometry(w, h), sky, x, y, ZB + 0.01, scene, false);
    add(new THREE.BoxGeometry(w + 0.14, 0.08, 0.12), frameMat, x, y + h / 2 + 0.04, ZB + 0.05);
    add(new THREE.BoxGeometry(w + 0.14, 0.08, 0.12), frameMat, x, y - h / 2 - 0.04, ZB + 0.05);
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.08, h, 0.12), frameMat, x + s * (w / 2 + 0.03), y, ZB + 0.05);
  }
  // the arched pediment over the central window
  const arch = add(new THREE.TorusGeometry(0.98, 0.06, 8, 32, Math.PI), frameMat, 0, 3.45, ZB + 0.06);

  /* ───────── the table ───────── */
  const TY = 0.8, TL = 8.6, TD = 1.0;
  const cloth = (() => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#ece6da'; g.fillRect(0, 0, 1024, 128);
    g.strokeStyle = 'rgba(150,140,125,.25)';
    for (let x = 0; x < 1024; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
    for (const x0 of [40, 930]) {                                   // blue woven bands near the ends
      g.fillStyle = '#5a7398';
      for (let i = 0; i < 6; i++) g.fillRect(x0 + i * 9, 0, 4, 128);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const clothMat = std('#ffffff', { map: cloth, roughness: 0.95 });
  add(new THREE.BoxGeometry(TL, 0.04, TD), clothMat, 0, TY, 0);
  add(new THREE.BoxGeometry(TL, 0.42, 0.02), clothMat, 0, TY - 0.21, TD / 2);       // front drape
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.02, 0.42, TD), clothMat, s * TL / 2, TY - 0.21, 0);
  const legMat = std('#5b4433');
  for (const x of [-3.9, -1.3, 1.3, 3.9]) for (const z of [-0.4, 0.4]) add(new THREE.BoxGeometry(0.08, TY - 0.42, 0.08), legMat, x, (TY - 0.42) / 2, z);

  // plates, bread, cups
  const pewter = std('#a7a49c', { roughness: 0.45, metalness: 0.35 });
  const bread = std('#b07a43');
  const glass = new THREE.MeshStandardMaterial({ color: '#cfd8d6', roughness: 0.1, transparent: true, opacity: 0.45 });
  for (let i = 0; i < 13; i++) {
    const x = -3.75 + i * 0.625;
    add(new THREE.CylinderGeometry(0.13, 0.11, 0.02, 24), pewter, x + (rnd() - .5) * .1, TY + 0.03, 0.12 + (rnd() - .5) * .08);
    const b = add(new THREE.SphereGeometry(0.055, 12, 8), bread, x + 0.2 + (rnd() - .5) * .1, TY + 0.05, 0.22 + rnd() * .1);
    b.scale.set(1.2, 0.7, 1);
    if (rnd() > 0.4) add(new THREE.CylinderGeometry(0.035, 0.03, 0.12, 16), glass, x - 0.18, TY + 0.08, 0.02 + rnd() * .1);
  }

  /* ───────── thirteen at table ───────── */
  // colours sampled by eye from the painting, left to right
  const people = [
    // name, x, robe, mantle, hair, beard, pose
    ['Bartholomew', -3.75, '#4d6b8a', '#5f6e3c', '#7a4a2a', false, { stand: 1, lean: [0.18, 0.12], arms: [[-1.1, 0.2, -0.4], [-1.25, -0.1, -0.3]], look: [0.5, 0] }],
    ['James Minor', -3.2, '#c9897a', '#6d7a48', '#8b6a3a', true, { lean: [0.05, 0.12], arms: [[-0.9, 0.3, -0.9], [-0.6, 0.5, -0.8]], look: [0.5, 0.1] }],
    ['Andrew', -2.7, '#c79a3e', '#617047', '#e6e1d6', true, { lean: [0, 0], arms: [[-0.3, 0.9, -1.7], [-0.3, -0.9, -1.7]], look: [0.2, 0] }],
    ['Judas', -1.95, '#3f6a96', '#4f5e3a', '#3a2a1f', true, { lean: [-0.25, -0.08], arms: [[-1.2, 0.1, -0.3], [-0.5, 0.0, -0.4]], look: [0.6, -0.1] }],
    ['Peter', -1.6, '#5d7fa6', '#b49a68', '#d8d3c8', true, { lean: [0.22, 0.25], arms: [[-0.8, 0.4, -1.2], [-0.4, -0.1, -0.6]], look: [-0.4, 0.2] }],
    ['John', -1.05, '#d79a8a', '#4a6f99', '#b07a45', false, { lean: [0.05, -0.32], arms: [[-0.9, 0.0, -0.5], [-0.9, 0.0, -0.5]], look: [0, -0.35] }],
    ['Christ', 0, '#b5432f', '#3c5f99', '#6b4426', true, { lean: [0, 0], arms: [[-0.9, 0.55, -0.4], [-0.9, -0.55, -0.4]], look: [0, 0.08], still: true }],
    ['Thomas', 0.95, '#6c8a55', '#a78358', '#6b4a2e', true, { lean: [0.1, 0.18], arms: [[-0.5, -0.2, -0.2], [-2.6, -0.1, -0.2]], look: [-0.3, 0] }],
    ['James Major', 1.45, '#8f9a5a', '#c28a54', '#7a5232', true, { lean: [-0.05, -0.05], arms: [[-0.6, 1.2, -0.4], [-0.6, -1.2, -0.4]], look: [-0.25, 0] }],
    ['Philip', 2.0, '#d88b6c', '#c06a4f', '#a87b4a', false, { lean: [0.2, 0.05], arms: [[-1.3, 0.4, -1.6], [-1.3, -0.4, -1.6]], look: [-0.5, 0] }],
    ['Matthew', 2.65, '#4f78ab', '#5d7aa0', '#b8823c', false, { lean: [-0.05, 0.25], arms: [[-1.3, -0.9, -0.2], [-1.2, -0.7, -0.3]], look: [0.6, 0] }],
    ['Thaddeus', 3.2, '#b88a3a', '#7f6a3b', '#c8c2b6', true, { lean: [0.05, -0.1], arms: [[-0.7, 0.3, -1.0], [-0.9, -0.6, -1.1]], look: [0.6, 0] }],
    ['Simon', 3.75, '#e2d3c3', '#c79a87', '#e0d9cc', true, { lean: [0.05, -0.15], arms: [[-1.0, 0.5, -0.8], [-1.0, -0.5, -0.9]], look: [0.4, 0] }],
  ];
  const skin = std('#d7a98a', { roughness: 0.7 });
  const figures = people.map(p => figure(...p));

  function figure(name, x, robe, mantle, hair, beard, pose) {
    const g = new THREE.Group();
    g.position.set(x, pose.stand ? 0.35 : 0, -0.62);
    scene.add(g);
    const robeMat = std(robe), mantleMat = std(mantle), hairMat = std(hair, { roughness: 0.95 });

    const torso = new THREE.Group(); torso.position.y = 0.45; g.add(torso);
    torso.rotation.set(pose.lean[1] * 0.6, 0, -pose.lean[0]);

    // robe and a mantle draped over one side, both turned on a lathe
    const prof = [[0.0, 0], [0.24, 0], [0.26, 0.15], [0.24, 0.38], [0.21, 0.53], [0.13, 0.6], [0.05, 0.63]].map(([r, y]) => new THREE.Vector2(r, y));
    const body = add(new THREE.LatheGeometry(prof, 28), robeMat, 0, 0, 0, torso); body.scale.z = 0.72;
    const drape = add(new THREE.LatheGeometry(prof.map(v => new THREE.Vector2(v.x * 1.07, v.y * 0.97)), 28, Math.PI * 0.15, Math.PI * 0.95), mantleMat, 0, -0.01, 0, torso);
    drape.scale.z = 0.76;
    if (x > 0.5) drape.rotation.y = Math.PI;

    add(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 12), skin, 0, 0.66, 0, torso);
    const head = new THREE.Group(); head.position.y = 0.78; torso.add(head);
    head.rotation.set(0, pose.look[0], pose.look[1]);
    const skull = add(new THREE.SphereGeometry(0.1, 24, 18), skin, 0, 0, 0, head); skull.scale.set(0.9, 1.12, 0.98);
    const cap = add(new THREE.SphereGeometry(0.108, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat, 0, 0.012, -0.012, head);
    cap.rotation.x = -0.35; cap.scale.set(0.95, 1.1, 1.05);
    if (['Christ', 'John', 'Philip', 'Matthew'].includes(name)) {
      add(new THREE.CylinderGeometry(0.09, 0.11, 0.2, 16, 1, true, Math.PI * 0.6, Math.PI * 0.8), hairMat, 0, -0.08, -0.01, head).rotation.y = Math.PI;
    }
    if (beard) { const b = add(new THREE.SphereGeometry(0.06, 16, 12), hairMat, 0, -0.085, 0.045, head); b.scale.set(1.0, 1.1, 0.75); }

    // two-segment arms: shoulder [pitch, yaw, roll-out] and an elbow bend
    const arms = pose.arms.map(([pitch, spread, bend], i) => {
      const s = i === 0 ? -1 : 1;
      const sh = new THREE.Group(); sh.position.set(s * 0.2, 0.55, 0); torso.add(sh);
      sh.rotation.set(pitch, 0, s * 0.15 + spread * -s * 0.6);
      add(new THREE.CylinderGeometry(0.05, 0.045, 0.27, 12), robeMat, 0, -0.135, 0, sh);
      const el = new THREE.Group(); el.position.y = -0.27; sh.add(el);
      el.rotation.x = bend;
      add(new THREE.CylinderGeometry(0.045, 0.04, 0.25, 12), robeMat, 0, -0.125, 0, el);
      add(new THREE.SphereGeometry(0.042, 12, 10), skin, 0, -0.27, 0, el).scale.set(0.8, 1.15, 0.6);
      return { sh, el, base: [sh.rotation.x, el.rotation.x] };
    });

    // a simple bench behind each figure
    add(new THREE.BoxGeometry(0.5, 0.06, 0.45), legMat, x, 0.42, -0.65);
    return { head, torso, arms, still: !!pose.still, look: pose.look.slice(), phase: rnd() * 6.28, rate: 0.6 + rnd() * 0.6, lean: torso.rotation.z };
  }

  /* ───────── the capture rig ───────── */
  // six synchronized cameras in an arc around the table, all aimed at the same moment
  const rigMat = std('#1d1d1f', { roughness: 0.5, metalness: 0.4 });
  const ledMat = new THREE.MeshBasicMaterial({ color: '#ff3b2f' });
  const leds = [];
  const aim = new THREE.Vector3(0, 1.1, 0);
  for (const deg of [-80, -62, -44, 44, 62, 80]) {
    const a = THREE.MathUtils.degToRad(deg), r = 4.6;
    const x = Math.sin(a) * r, z = Math.cos(a) * r * 0.85 + 0.3;
    const hgt = 1.55;
    const tri = new THREE.Group(); tri.position.set(x, 0, z); scene.add(tri);
    for (let k = 0; k < 3; k++) {
      const leg = add(new THREE.CylinderGeometry(0.008, 0.008, hgt, 6), rigMat, 0, hgt / 2, 0, tri);
      const ang = k * Math.PI * 2 / 3;
      leg.position.set(Math.cos(ang) * 0.17, hgt / 2, Math.sin(ang) * 0.17);
      leg.rotation.set(Math.sin(ang) * 0.13, 0, -Math.cos(ang) * 0.13);
    }
    const head = new THREE.Group(); head.position.set(x, hgt, z); scene.add(head);
    head.lookAt(aim);
    add(new THREE.BoxGeometry(0.16, 0.11, 0.13), rigMat, 0, 0, 0, head);
    add(new THREE.CylinderGeometry(0.035, 0.04, 0.09, 16), rigMat, 0, 0, 0.1, head).rotation.x = Math.PI / 2;
    leds.push(add(new THREE.SphereGeometry(0.012, 8, 6), ledMat, 0.055, 0.035, 0.066, head, false));
  }

  /* ───────── light ───────── */
  scene.add(new THREE.HemisphereLight('#fff2dc', '#4a3a2c', 0.9));
  const sun = new THREE.DirectionalLight('#ffe7c4', 2.1);           // Leonardo lights the room from the left
  sun.position.set(-4.5, 6.5, 5.5);
  sun.target.position.set(0, 0.8, -1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 5, bottom: -3, near: 1, far: 25 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  const glow = new THREE.PointLight('#cfe0ff', 6, 14, 1.6);          // daylight through the windows
  glow.position.set(0, 2.6, ZB + 1.2);
  scene.add(glow);

  /* ───────── view and interaction ───────── */
  // at rest: one-point perspective, eye at Christ's head, as in the fresco
  const target = new THREE.Vector3(0, 1.25, -1);
  const R0 = 8.2;
  const P0 = 0.07;
  const cur = { yaw: 0, pitch: P0 }, tgt = { yaw: 0, pitch: P0 };
  function place() {
    camera.position.set(
      target.x + R0 * Math.sin(cur.yaw) * Math.cos(cur.pitch),
      target.y + R0 * Math.sin(cur.pitch),
      target.z + R0 * Math.cos(cur.yaw) * Math.cos(cur.pitch));
    camera.lookAt(target);
  }

  const YAW = 0.62, PITCH = 0.32;
  let user = false;
  const fixed = new URLSearchParams(location.search).get('view');   // e.g. ?view=0.5,0.2 pins the camera
  if (fixed) { const [y, p] = fixed.split(',').map(Number); Object.assign(cur, { yaw: y, pitch: p }); Object.assign(tgt, cur); user = true; }
  function aimAt(e) {
    const r = stage.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    tgt.yaw = -nx * YAW; tgt.pitch = P0 + Math.max(-0.1, -ny * PITCH); user = true;
  }
  const home = () => { tgt.yaw = 0; tgt.pitch = P0; user = false; };
  stage.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || e.buttons) aimAt(e); });
  stage.addEventListener('pointerdown', aimAt);
  stage.addEventListener('pointerleave', home);
  stage.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') home(); });
  stage.addEventListener('pointercancel', home);

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    dirty = true;
  }

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let dirty = true, visible = true, t0 = performance.now();
  function frame(now) {
    const t = (now - t0) / 1000;
    if (!reduce) {
      // the scene is dynamic: everyone fidgets a little, except the one who keeps still
      for (const f of figures) {
        if (f.still) continue;
        const s = Math.sin(t * f.rate + f.phase);
        f.head.rotation.y = f.look[0] + 0.14 * s;
        f.torso.rotation.z = f.lean + 0.025 * Math.sin(t * f.rate * 0.7 + f.phase);
        for (const a of f.arms) { a.sh.rotation.x = a.base[0] + 0.07 * s; a.el.rotation.x = a.base[1] + 0.09 * Math.cos(t * f.rate + f.phase); }
      }
      const blink = (Math.sin(t * 3.2) > 0) ? 1 : 0.15;
      for (const l of leds) l.material.color.setScalar(1).setRGB(1 * blink, 0.23 * blink, 0.18 * blink);
      if (!user) tgt.yaw = 0.07 * Math.sin(t * 0.18);                // a slow, idle drift
    }
    cur.yaw += (tgt.yaw - cur.yaw) * 0.06;
    cur.pitch += (tgt.pitch - cur.pitch) * 0.06;
    place();
    renderer.render(scene, camera);
    dirty = false;
    if (visible) requestAnimationFrame(frame);
  }

  resize(); place();
  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver(([e]) => {
    const was = visible; visible = e.isIntersecting && !document.hidden;
    if (visible && !was) requestAnimationFrame(frame);
  }).observe(stage);
  document.addEventListener('visibilitychange', () => {
    const was = visible; visible = !document.hidden;
    if (visible && !was) requestAnimationFrame(frame);
  });
  requestAnimationFrame(t => { frame(t); stage.classList.add('ready'); });
}

function mulberry(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
