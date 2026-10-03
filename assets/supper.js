// Leonardo's Last Supper, lifted into depth.
//
// The fresco is a single perspective view with its vanishing point at Christ's head. From the
// receding wall edges we recover that camera and a box-shaped refectory consistent with it. The
// painting is split into two layers: the empty room (the wall behind the figures filled in) laid
// over that box, and the thirteen at table as a cut-out with a little relief. Scrolling performs
// a dolly zoom: the camera moves into the room while the lens widens, so the figures hold still
// and the refectory deepens around them.
import * as THREE from 'three';

const IW = 1600, IH = 901, F = 1600, CX = 803, CY = 457;     // the painter's camera, in pixels
const R = {                                                    // the room, in metres; camera at the origin looking down -z
  zb: -30, xl: -4.84, xr: 4.86, yc: 4.41, yf: -2.75,
  zt: -10.6, yt: -1.21, ytb: -1.93,
  xt0: (115 - CX) * 10.6 / F, xt1: (1510 - CX) * 10.6 / F
};
const FIG = { x0: 106.4, y0: 417.6, x1: 1552.8, y1: 653.6, z: 11.9, relief: 0.55 };
const DOLLY = 3.6;                                             // metres travelled at full scroll

const stage = document.getElementById('stage');
const canvas = document.getElementById('view');
let renderer = null;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); } catch (e) {}

const clamp01 = x => Math.min(1, Math.max(0, x));

// depth (distance along -z) of the first room surface on the ray through pixel (u, v)
function roomDepth(u, v) {
  const dx = (u - CX) / F, dy = -(v - CY) / F;
  const zf = -8;                                                 // walls run a little past the frame, for margin
  const within = (a, lo, hi) => a >= Math.min(lo, hi) - 1e-3 && a <= Math.max(lo, hi) + 1e-3;
  let z = Infinity;
  const test = (t, ok) => { if (ok && t > 0 && t < z) z = t; };
  for (const x of [R.xl, R.xr]) { const t = x / dx; test(t, dx !== 0 && within(t * dy, R.yf, R.yc) && within(-t, R.zb, zf)); }
  for (const y of [R.yc, R.yf]) { const t = y / dy; test(t, dy !== 0 && within(t * dx, R.xl, R.xr) && within(-t, R.zb, zf)); }
  test(-R.zb, within(-R.zb * dx, R.xl, R.xr) && within(-R.zb * dy, R.yf, R.yc));
  test(-R.zt, within(-R.zt * dx, R.xt0, R.xt1) && within(-R.zt * dy, R.ytb, R.yt));
  { const t = R.yt / dy; test(t, dy < 0 && within(t * dx, R.xt0, R.xt1) && within(-t, -FIG.z, R.zt)); }
  return Number.isFinite(z) ? z : 10;
}

const loadImage = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });

async function start() {
  const [roomImg, figImg, reliefImg] = await Promise.all(
    ['assets/supper-room.jpg', 'assets/supper-figures.webp', 'assets/supper-relief.png'].map(loadImage));

  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#5a5047');
  const camera = new THREE.PerspectiveCamera();

  const texture = (img, wrap = THREE.ClampToEdgeWrapping) => {
    const t = new THREE.Texture(img);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true;
    t.wrapS = t.wrapT = wrap;
    return t;
  };

  // a grid of vertices, each pushed out along its own ray to the depth given by depthAt(u, v)
  function sheet(u0, v0, u1, v1, nx, ny, depthAt, uvAt) {
    const pos = [], uv = [], idx = [];
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const u = u0 + (u1 - u0) * i / nx, v = v0 + (v1 - v0) * j / ny;
      const z = depthAt(u, v);
      pos.push((u - CX) / F * z, -(v - CY) / F * z, -z);
      uv.push(...uvAt(u, v));
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }

  // the room, with a margin beyond the frame (the fresco mirrored) so the camera never finds its edge
  const M = 160;
  scene.add(new THREE.Mesh(
    sheet(-M, -M, IW + M, IH + M, 300, 180, roomDepth, (u, v) => [u / IW, 1 - v / IH]),
    new THREE.MeshBasicMaterial({ map: texture(roomImg, THREE.MirroredRepeatWrapping) })));

  // the thirteen at table, with relief read from a small height map
  const rc = document.createElement('canvas'); rc.width = reliefImg.width; rc.height = reliefImg.height;
  const rctx = rc.getContext('2d'); rctx.drawImage(reliefImg, 0, 0);
  const rel = rctx.getImageData(0, 0, rc.width, rc.height).data;
  const reliefAt = (u, v) => {
    const x = Math.round(clamp01((u - FIG.x0) / (FIG.x1 - FIG.x0)) * (rc.width - 1));
    const y = Math.round(clamp01((v - FIG.y0) / (FIG.y1 - FIG.y0)) * (rc.height - 1));
    return rel[(y * rc.width + x) * 4] / 255;
  };
  // never behind the room surface it was painted over (hands stay on the table)
  const figDepth = (u, v) => Math.min(FIG.z - FIG.relief * reliefAt(u, v), roomDepth(u, v) - 0.06);
  const figures = new THREE.Mesh(
    sheet(FIG.x0, FIG.y0, FIG.x1, FIG.y1, 420, 70, figDepth,
      (u, v) => [(u - FIG.x0) / (FIG.x1 - FIG.x0), 1 - (v - FIG.y0) / (FIG.y1 - FIG.y0)]),
    new THREE.MeshBasicMaterial({ map: texture(figImg), transparent: true, alphaTest: 0.05 }));
  figures.renderOrder = 1;
  scene.add(figures);

  /* ── camera: Leonardo's intrinsics, scaled for the dolly zoom ── */
  const state = { dolly: 0, px: 0, py: 0 }, goal = { dolly: 0, px: 0, py: 0 };
  function setCamera() {
    const dz = state.dolly * DOLLY;
    const f = F * (FIG.z - dz) / FIG.z * 1.035;                  // the figures keep their size; a hair of overscan
    const n = 0.05;
    camera.position.set(state.px, state.py, -dz);
    camera.updateMatrixWorld();
    camera.projectionMatrix.makePerspective(-CX / f * n, (IW - CX) / f * n, CY / f * n, -(IH - CY) / f * n, n, 200);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }

  // scroll drives the dolly; the cursor adds a slight parallax
  let intro = 0;
  const scrollGoal = () => {
    const r = stage.getBoundingClientRect();
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const span = Math.min(maxScroll, r.bottom + scrollY - 40);
    return clamp01(scrollY / Math.max(span, 240));
  };
  const update = () => { goal.dolly = Math.max(scrollGoal(), intro); kick(); };
  addEventListener('scroll', update, { passive: true });
  stage.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const r = stage.getBoundingClientRect();
    goal.px = (((e.clientX - r.left) / r.width) * 2 - 1) * 0.22;
    goal.py = -(((e.clientY - r.top) / r.height) * 2 - 1) * 0.1;
    kick();
  });
  stage.addEventListener('pointerleave', () => { goal.px = 0; goal.py = 0; kick(); });

  let running = false, dirty = true;
  function frame() {
    let moving = false;
    for (const k of ['dolly', 'px', 'py']) {
      const d = goal[k] - state[k];
      state[k] += d * 0.08;
      if (Math.abs(d) > 1e-4) moving = true;
    }
    if (moving || dirty) { setCamera(); renderer.render(scene, camera); dirty = false; }
    if (moving) requestAnimationFrame(frame); else running = false;
  }
  function kick() { if (!running) { running = true; requestAnimationFrame(frame); } }
  function resize() { renderer.setSize(stage.clientWidth, stage.clientHeight, false); dirty = true; kick(); }

  // test hook: ?view=dolly,px,py pins the camera
  const pin = new URLSearchParams(location.search).get('view');
  if (pin) {
    const [d, x, y] = pin.split(',').map(Number);
    Object.assign(state, { dolly: d || 0, px: x || 0, py: y || 0 }); Object.assign(goal, state);
    intro = state.dolly;
  }

  resize(); update();
  setCamera(); renderer.render(scene, camera);
  stage.classList.add('ready');
  new ResizeObserver(resize).observe(stage);

  // on arrival, a short step into the room and back, so the depth announces itself
  if (!pin && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      setTimeout(() => { intro = 0.38; update(); setTimeout(() => { intro = 0; update(); }, 1500); }, 700);
    }, { threshold: 0.6 });
    io.observe(stage);
  }
}

if (renderer) start().catch(e => { console.error(e); stage.classList.add('fallback'); });
else stage.classList.add('fallback');
