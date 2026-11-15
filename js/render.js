// Cursor Racing — pixel-art diorama renderer: lit voxels + pixel sprites, shadow map, point lights,
// then bloom, tilt-shift depth of field, vignette and colour grading.
(function (CR) {
  'use strict';
  const { U, M4, G } = CR;

  const VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNor; layout(location=2) in vec4 aCol; layout(location=3) in vec2 aUV;
uniform mat4 uVP, uM, uLVP;
out vec3 vW; out vec3 vN; out vec4 vC; out vec2 vUV; out vec4 vL;
void main(){ vec4 w = uM * vec4(aPos, 1.0); vW = w.xyz; vN = mat3(uM) * aNor; vC = aCol; vUV = aUV; vL = uLVP * w; gl_Position = uVP * w; }`;

  const FS = `#version 300 es
precision highp float; precision highp sampler2DShadow;
in vec3 vW; in vec3 vN; in vec4 vC; in vec2 vUV; in vec4 vL;
uniform sampler2D uTex; uniform sampler2DShadow uSh;
uniform int uMode; uniform int uNP;
uniform vec3 uSun, uSunC, uSky, uGnd, uFog, uCam; uniform float uFogD, uShOn, uDither, uEmis, uFloorY, uFogS;
uniform vec4 uTint; uniform vec4 uPL[12]; uniform vec3 uPC[12];
out vec4 o;
float shadow(){
  vec3 p = vL.xyz / vL.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  vec2 t = 1.0 / vec2(textureSize(uSh, 0)); float s = 0.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) s += texture(uSh, vec3(p.xy + vec2(x, y) * t * 1.2, p.z - 0.0012));
  return s / 9.0;
}
void main(){
  vec4 tx = texture(uTex, vUV);
  vec3 base; float em; float alpha = 1.0;
  if (uMode == 1) { base = tx.rgb; em = (1.0 - tx.a) * 2.0; }
  else if (uMode == 2) { base = vC.rgb; em = 0.0; alpha = vC.a; }
  else if (uMode == 3) { base = vC.rgb * (0.85 + tx.r * 0.3); em = 0.0; }
  else { if (tx.a < 0.5) discard; base = vC.rgb * tx.rgb; em = vC.a; }
  if (uDither > 0.5 && mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) < 1.0) discard;
  base *= uTint.rgb;
  vec3 c;
  if (uMode == 2) { c = base * uEmis; }
  else {
    vec3 n = normalize(vN);
    float sh = uShOn > 0.5 ? shadow() : 1.0;
    vec3 lit = mix(uGnd, uSky, n.y * 0.5 + 0.5) + uSunC * max(dot(n, uSun), 0.0) * sh;
    for (int i = 0; i < 12; i++) {
      if (i >= uNP) break;
      vec3 d = uPL[i].xyz - vW; float l = length(d); float a = max(0.0, 1.0 - l / uPL[i].w); a *= a;
      lit += uPC[i] * a * (max(dot(n, d / max(l, 0.001)), 0.0) * 0.85 + 0.2);
    }
    c = base * lit + base * em * 1.8;
  }
  float dist = length(vW - uCam);
  float f = 1.0 - exp(-uFogD * max(0.0, dist - uFogS));
  f = max(f, clamp(-vW.y / -uFloorY, 0.0, 1.0) * 0.72);
  c = mix(c, uFog, clamp(f, 0.0, 1.0) * (uMode == 2 ? 0.4 : 1.0));
  o = vec4(c, alpha * uTint.a);
}`;

  const SVS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=3) in vec2 aUV;
uniform mat4 uLVP, uM; out vec2 vUV;
void main(){ vUV = aUV; gl_Position = uLVP * uM * vec4(aPos, 1.0); }`;
  const SFS = `#version 300 es
precision mediump float; in vec2 vUV; uniform sampler2D uTex; out vec4 o;
void main(){ if (texture(uTex, vUV).a < 0.5) discard; o = vec4(1.0); }`;

  const QVS = `#version 300 es
out vec2 v; void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); v = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
  const BRIGHT = `#version 300 es
precision mediump float; in vec2 v; uniform sampler2D uS; uniform float uThr; out vec4 o;
void main(){ vec3 c = texture(uS, v).rgb; float l = max(c.r, max(c.g, c.b)); float k = max(l - uThr, 0.0) / max(l, 0.0001); o = vec4(c * k, 1.0); }`;
  const COPY = `#version 300 es
precision mediump float; in vec2 v; uniform sampler2D uS; out vec4 o; void main(){ o = texture(uS, v); }`;
  const BLUR = `#version 300 es
precision mediump float; in vec2 v; uniform sampler2D uS; uniform vec2 uDir; out vec4 o;
void main(){
  vec3 c = texture(uS, v).rgb * 0.227;
  c += (texture(uS, v + uDir * 1.385).rgb + texture(uS, v - uDir * 1.385).rgb) * 0.316;
  c += (texture(uS, v + uDir * 3.231).rgb + texture(uS, v - uDir * 3.231).rgb) * 0.070;
  o = vec4(c, 1.0);
}`;
  const COMP = `#version 300 es
precision highp float; in vec2 v;
uniform sampler2D uS, uB, uD; uniform float uFocus, uBand, uDof, uBloom, uVig, uExpo, uTime, uSat, uFlash;
uniform vec3 uGrade; out vec4 o;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec3 s = texture(uS, v).rgb;
  vec3 d = texture(uD, v).rgb;
  float t = smoothstep(uBand, uBand + 0.32, abs(v.y - uFocus)) * uDof;
  vec3 c = mix(s, d, t);
  c += texture(uB, v).rgb * uBloom;
  c = 1.0 - exp(-c * uExpo * 1.55);
  c *= uGrade;
  float l = dot(c, vec3(0.299, 0.587, 0.114)); c = mix(vec3(l), c, uSat);
  c = mix(c * vec3(0.93, 0.97, 1.06), c * vec3(1.05, 1.0, 0.93), smoothstep(0.2, 0.8, l));
  vec2 q = (v - 0.5) * vec2(1.0, 1.1);
  c *= mix(1.0, smoothstep(0.95, 0.2, length(q)), 0.55 * uVig);
  c += (1.0 - v.y) * (1.0 - v.x) * 0.05 * vec3(1.0, 0.92, 0.75);
  c += (hash(v * 913.0 + uTime) - 0.5) * 0.022;
  c = mix(c, vec3(1.0), uFlash);
  o = vec4(c, 1.0);
}`;

  const R = {
    gl: null, quality: 'medium', opts: { dof: true, bloom: true, shadows: true },
    cam: { x: 0, y: 0, z: 0, dist: 900, pitch: 1.0, fov: 0.52, shake: 0, flash: 0 },
  };
  const QUAL = { low: { scale: 0.55, shadow: 1024, maxDpr: 1.5 }, medium: { scale: 0.8, shadow: 1536, maxDpr: 2 }, high: { scale: 1, shadow: 2048, maxDpr: 2.5 } };

  R.init = function (canvas) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) return false;
    R.gl = gl; R.canvas = canvas;
    G.hdrOK = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
    R.main = G.program(gl, VS, FS); R.shadowP = G.program(gl, SVS, SFS);
    R.bright = G.program(gl, QVS, BRIGHT); R.blur = G.program(gl, QVS, BLUR); R.comp = G.program(gl, QVS, COMP); R.copy = G.program(gl, QVS, COPY);
    R.atlasTex = G.texture(gl, CR.atlas.canvas);
    // floor noise
    const fc = document.createElement('canvas'); fc.width = fc.height = 64; const fx = fc.getContext('2d'), r = U.rng(5);
    for (let i = 0; i < 64; i++) for (let j = 0; j < 64; j++) { const k = 110 + r() * 60 + ((i >> 3) + (j >> 3)) % 2 * 20; fx.fillStyle = `rgb(${k},${k},${k})`; fx.fillRect(i, j, 1, 1); }
    R.floorTex = G.texture(gl, fc, { repeat: true });
    R.emptyVAO = gl.createVertexArray();
    R.dyn = { alpha: null, add: null, skid: null };
    gl.enable(gl.DEPTH_TEST);
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); R.lost = true; }, false);
    canvas.addEventListener('webglcontextrestored', () => location.reload(), false);
    return true;
  };

  R.setQuality = function (q, opts) {
    R.quality = q; Object.assign(R.opts, opts || {});
    R.sizeKey = ''; R.shadow && (R.gl.deleteTexture(R.shadow.tex), R.gl.deleteFramebuffer(R.shadow.fb)); R.shadow = null;
  };

  function ensureTargets(w, h) {
    const gl = R.gl, Q = QUAL[R.quality];
    const key = `${w}x${h}`;
    if (R.sizeKey === key && R.shadow) return;
    R.sizeKey = key;
    for (const t of ['tScene', 'tHalf', 'tHalf2', 'tQ1', 'tQ2']) G.freeTarget(gl, R[t]);
    R.tScene = G.target(gl, w, h, { depth: true, hdr: true });
    const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1), qw = Math.max(1, w >> 2), qh = Math.max(1, h >> 2);
    R.tHalf = G.target(gl, hw, hh, { hdr: true }); R.tHalf2 = G.target(gl, hw, hh, { hdr: true });
    R.tQ1 = G.target(gl, qw, qh, { hdr: true }); R.tQ2 = G.target(gl, qw, qh, { hdr: true });
    if (!R.shadow) R.shadow = G.shadowTarget(gl, Q.shadow);
  }

  R.resize = function () {
    const Q = QUAL[R.quality], dpr = Math.min(window.devicePixelRatio || 1, Q.maxDpr);
    const cw = window.innerWidth, ch = window.innerHeight;
    const w = Math.max(2, Math.round(cw * dpr * Q.scale)), h = Math.max(2, Math.round(ch * dpr * Q.scale));
    if (R.canvas.width !== w || R.canvas.height !== h) { R.canvas.width = w; R.canvas.height = h; }
    R.w = w; R.h = h; R.aspect = w / h;
  };

  R.setWorld = function (world) {
    const gl = R.gl;
    if (R.world) R.freeWorld();
    R.world = world;
    world.build(gl);
    R.groundTex = G.texture(gl, world.groundCanvas);
    const b = new G.Builder(4), W = world.W, H = world.H;
    const q = [[0, 0, 0, 0, 0], [W, 0, 0, 1, 0], [W, 0, H, 1, 1], [0, 0, H, 0, 1]].map((p) => b.v(p[0], p[1], p[2], 0, 1, 0, 1, 1, 1, 0, p[3], p[4]));
    b.quad(q[0], q[1], q[2], q[3]);
    R.groundMesh = G.upload(gl, b);
    R.tableMesh = G.upload(gl, world.tableMesh); R.floorMesh = G.upload(gl, world.floorMesh);
  };
  R.freeWorld = function () {
    const gl = R.gl, w = R.world; if (!w) return;
    for (const m of w.meshes || []) G.free(gl, m.mesh);
    for (const b of w.balls) G.free(gl, b.mesh);
    G.free(gl, R.groundMesh); G.free(gl, R.tableMesh); G.free(gl, R.floorMesh);
    if (R.groundTex) gl.deleteTexture(R.groundTex);
    R.world = null;
  };

  // camera: looks at (x, 0, y) from the south and above
  R.camMatrices = function () {
    const c = R.cam, sx = (Math.random() - 0.5) * c.shake, sy = (Math.random() - 0.5) * c.shake;
    const tx = c.x + sx, tz = c.y + sy, ty = c.z || 0;
    const eye = [tx + Math.sin(c.yaw || 0) * Math.cos(c.pitch) * c.dist, ty + Math.sin(c.pitch) * c.dist, tz + Math.cos(c.yaw || 0) * Math.cos(c.pitch) * c.dist];
    const V = M4.lookAt(eye, [tx, ty, tz], [0, 1, 0]);
    const P = M4.persp(c.fov, R.aspect, Math.max(20, c.dist * 0.2), c.dist * 4 + 2000);
    R.VP = M4.mul(P, V); R.V = V; R.eye = eye;
    R.right = [V[0], V[4], V[8]]; R.up = [V[1], V[5], V[9]];
    return R.VP;
  };
  // distance that keeps a radius r of ground in view, whatever the screen shape
  R.fitDist = function (r) { return r / (Math.tan(R.cam.fov / 2) * Math.min(1, R.aspect)); };
  R.project = function (x, y, z = 0) { const p = M4.xform(R.VP, x, z, y); return [p[0] / p[3], p[1] / p[3], p[3]]; };

  function lightMatrix(world) {
    const L = world.light, s = L.sun, size = R.cam.dist * 1.25 + 300;
    const V = M4.lookAt([s[0] * 3000, s[1] * 3000, s[2] * 3000], [0, 0, 0], Math.abs(s[1]) > 0.98 ? [0, 0, -1] : [0, 1, 0]);
    const t = M4.xform(V, R.cam.x, 0, R.cam.y);
    const texel = size / R.shadow.size;
    const cx = Math.round(t[0] / texel) * texel, cy = Math.round(t[1] / texel) * texel;
    const P = M4.ortho(cx - size / 2, cx + size / 2, cy - size / 2, cy + size / 2, -t[2] - 1800, -t[2] + 1800);
    return M4.mul(P, V);
  }

  const ID = M4.ident(), TMP = new Float32Array(16);
  // scene: { cars: [{mesh, m, ghost, tint}], parts: {alpha, add}, skid, lights: [], time, focusY, flash }
  R.render = function (scene) {
    const gl = R.gl, world = R.world; if (!world || R.lost) return;
    R.resize(); ensureTargets(R.w, R.h);
    const L = world.light, VP = R.camMatrices(), LVP = lightMatrix(world);
    const cx = R.cam.x, cy = R.cam.y, viewR = R.cam.dist * 1.3 + 600;
    const visible = world.meshes.filter((m) => Math.abs(m.cx - cx) < viewR + 500 && Math.abs(m.cy - cy) < viewR + 500);

    // ---- shadow pass ----
    if (R.opts.shadows) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, R.shadow.fb); gl.viewport(0, 0, R.shadow.size, R.shadow.size);
      gl.clear(gl.DEPTH_BUFFER_BIT); gl.useProgram(R.shadowP.p);
      gl.uniformMatrix4fv(R.shadowP.u.uLVP, false, LVP);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, R.atlasTex); gl.uniform1i(R.shadowP.u.uTex, 0);
      gl.uniformMatrix4fv(R.shadowP.u.uM, false, ID);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5, 2.0);
      for (const m of visible) draw(m.mesh);
      for (const c of scene.cars) { if (c.ghost) continue; gl.uniformMatrix4fv(R.shadowP.u.uM, false, c.m); draw(c.mesh); }
      for (const b of world.balls) { gl.uniformMatrix4fv(R.shadowP.u.uM, false, b.m || ID); draw(b.mesh); }
      gl.disable(gl.POLYGON_OFFSET_FILL);
    }

    // ---- scene pass ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, R.tScene.fb); gl.viewport(0, 0, R.w, R.h);
    const cl = L.fog; gl.clearColor(cl[0], cl[1], cl[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const P = R.main, u = P.u; gl.useProgram(P.p);
    gl.uniformMatrix4fv(u.uVP, false, VP); gl.uniformMatrix4fv(u.uLVP, false, LVP);
    const sn = L.sun, sl = Math.hypot(sn[0], sn[1], sn[2]);
    gl.uniform3f(u.uSun, sn[0] / sl, sn[1] / sl, sn[2] / sl); gl.uniform3fv(u.uSunC, L.sunCol); gl.uniform3fv(u.uSky, L.sky); gl.uniform3fv(u.uGnd, L.gnd);
    gl.uniform3fv(u.uFog, L.fog); gl.uniform1f(u.uFogD, L.fogDen); gl.uniform1f(u.uFogS, R.cam.dist * 1.15); gl.uniform3fv(u.uCam, R.eye); gl.uniform1f(u.uFloorY, world.floorY);
    gl.uniform1f(u.uShOn, R.opts.shadows ? 1 : 0); gl.uniform1f(u.uDither, 0); gl.uniform1f(u.uEmis, 1); gl.uniform4f(u.uTint, 1, 1, 1, 1);
    // lights: nearest to the camera target
    const lights = world.lights.concat(scene.lights || []);
    lights.sort((a, b) => ((a.x - cx) ** 2 + (a.z - cy) ** 2) - ((b.x - cx) ** 2 + (b.z - cy) ** 2));
    const n = Math.min(12, lights.length), pl = new Float32Array(48), pc = new Float32Array(36);
    for (let i = 0; i < n; i++) { const l = lights[i]; pl.set([l.x, l.y, l.z, l.rad], i * 4); pc.set(l.col, i * 3); }
    gl.uniform1i(u.uNP, n); if (n) { gl.uniform4fv(u.uPL, pl); gl.uniform3fv(u.uPC, pc); }
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, R.shadow.tex); gl.uniform1i(u.uSh, 1);
    gl.activeTexture(gl.TEXTURE0); gl.uniform1i(u.uTex, 0);
    gl.uniformMatrix4fv(u.uM, false, ID);
    // floor
    gl.bindTexture(gl.TEXTURE_2D, R.floorTex); gl.uniform1i(u.uMode, 3); draw(R.floorMesh);
    // table
    gl.bindTexture(gl.TEXTURE_2D, R.atlasTex); gl.uniform1i(u.uMode, 0); draw(R.tableMesh);
    // ground
    gl.bindTexture(gl.TEXTURE_2D, R.groundTex); gl.uniform1i(u.uMode, 1); draw(R.groundMesh);
    // skid marks (decals on the ground)
    gl.bindTexture(gl.TEXTURE_2D, R.atlasTex);
    if (scene.skid && scene.skid.idx.length) {
      gl.uniform1i(u.uMode, 2); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -2);
      R.dyn.skid = dynDraw(R.dyn.skid, scene.skid);
      gl.disable(gl.POLYGON_OFFSET_FILL); gl.depthMask(true); gl.disable(gl.BLEND);
    }
    // static props
    gl.uniform1i(u.uMode, 0);
    for (const m of visible) draw(m.mesh);
    for (const b of world.balls) { gl.uniformMatrix4fv(u.uM, false, b.m || ID); draw(b.mesh); }
    // cars
    for (const c of scene.cars) {
      gl.uniformMatrix4fv(u.uM, false, c.m);
      gl.uniform1f(u.uDither, c.ghost ? 1 : 0);
      const t = c.tint || [1, 1, 1];
      gl.uniform4f(u.uTint, t[0], t[1], t[2], 1);
      if (c.flicker && Math.floor(scene.time * 14) % 2) continue;
      draw(c.mesh);
    }
    gl.uniform1f(u.uDither, 0); gl.uniform4f(u.uTint, 1, 1, 1, 1);
    gl.uniformMatrix4fv(u.uM, false, ID);
    // particles
    if (scene.parts) {
      gl.uniform1i(u.uMode, 2); gl.enable(gl.BLEND); gl.depthMask(false);
      if (scene.parts.alpha.idx.length) { gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.uniform1f(u.uEmis, 1); R.dyn.alpha = dynDraw(R.dyn.alpha, scene.parts.alpha); }
      if (scene.parts.add.idx.length) { gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.uniform1f(u.uEmis, 2.2); R.dyn.add = dynDraw(R.dyn.add, scene.parts.add); }
      gl.depthMask(true); gl.disable(gl.BLEND); gl.uniform1f(u.uEmis, 1);
    }

    // ---- post ----
    gl.disable(gl.DEPTH_TEST);
    const thr = G.hdrOK ? 1.0 : 0.82;
    const pass = (prog, target, tex, set) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
      gl.viewport(0, 0, target ? target.w : R.w, target ? target.h : R.h);
      gl.useProgram(prog.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(prog.u.uS, 0);
      if (set) set(prog.u);
      gl.bindVertexArray(R.emptyVAO); gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const blur2 = (a, b, k) => {
      pass(R.blur, b, a.tex, (uu) => gl.uniform2f(uu.uDir, k / a.w, 0));
      pass(R.blur, a, b.tex, (uu) => gl.uniform2f(uu.uDir, 0, k / a.h));
    };
    // bloom
    if (R.opts.bloom) {
      pass(R.bright, R.tHalf, R.tScene.tex, (uu) => gl.uniform1f(uu.uThr, thr));
      pass(R.copy, R.tQ1, R.tHalf.tex);
      blur2(R.tQ1, R.tQ2, 1.0); blur2(R.tQ1, R.tQ2, 2.0);
    } else { gl.bindFramebuffer(gl.FRAMEBUFFER, R.tQ1.fb); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
    // depth-of-field blur
    pass(R.copy, R.tHalf, R.tScene.tex);
    blur2(R.tHalf, R.tHalf2, 1.2); blur2(R.tHalf, R.tHalf2, 2.4);
    // composite
    pass(R.comp, null, R.tScene.tex, (uu) => {
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, R.tQ1.tex); gl.uniform1i(uu.uB, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, R.tHalf.tex); gl.uniform1i(uu.uD, 2);
      gl.uniform1f(uu.uFocus, scene.focusY ?? 0.5); gl.uniform1f(uu.uBand, scene.band ?? 0.16);
      gl.uniform1f(uu.uDof, R.opts.dof ? (scene.dof ?? 1) : 0); gl.uniform1f(uu.uBloom, R.opts.bloom ? L.bloom : 0);
      gl.uniform1f(uu.uVig, L.vignette || 1); gl.uniform1f(uu.uExpo, L.exposure); gl.uniform1f(uu.uTime, (scene.time || 0) % 10);
      gl.uniform1f(uu.uSat, 1.12); gl.uniform3fv(uu.uGrade, L.grade); gl.uniform1f(uu.uFlash, R.cam.flash || 0);
    });
    gl.activeTexture(gl.TEXTURE0);
    gl.enable(gl.DEPTH_TEST);
    gl.bindVertexArray(null);
  };

  function draw(m) { const gl = R.gl; if (!m || !m.count) return; gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0); }
  function dynDraw(mesh, bld) { const gl = R.gl; if (!mesh) mesh = G.upload(gl, bld, true); else G.refill(gl, mesh, bld); draw(mesh); return mesh; }

  R.carMatrix = function (x, y, z, heading, pitch, roll, out) { return M4.model(x, z, y, -heading, pitch, roll, 1, out || new Float32Array(16)); };

  CR.R = R;
})(window.CR);
