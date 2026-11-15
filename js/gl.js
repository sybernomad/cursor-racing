// Cursor Racing — WebGL2 helpers: programs, meshes, render targets, and the voxel mesher.
(function (CR) {
  'use strict';
  const G = {};

  G.program = function (gl, vs, fs) {
    const mk = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src);
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos'); gl.bindAttribLocation(p, 1, 'aNor');
    gl.bindAttribLocation(p, 2, 'aCol'); gl.bindAttribLocation(p, 3, 'aUV');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  };

  // ---------------------------------------------------------------------------
  // Mesh builder. Vertex: pos(3f) normal(3f) color(4ub: rgb + emissive) uv(2f) = 36 bytes
  // ---------------------------------------------------------------------------
  const STRIDE = 36;
  class Builder {
    constructor(cap = 4096) { this.buf = new ArrayBuffer(cap * STRIDE); this.f = new Float32Array(this.buf); this.b = new Uint8Array(this.buf); this.n = 0; this.idx = []; }
    grow(extra) {
      const need = (this.n + extra) * STRIDE;
      if (need <= this.buf.byteLength) return;
      let cap = this.buf.byteLength * 2; while (cap < need) cap *= 2;
      const nb = new ArrayBuffer(cap); new Uint8Array(nb).set(this.b);
      this.buf = nb; this.f = new Float32Array(nb); this.b = new Uint8Array(nb);
    }
    v(x, y, z, nx, ny, nz, r, g, b, e, u = 0.004, w = 0.004) {
      this.grow(1);
      const o = this.n * 9, bo = this.n * STRIDE + 24;
      const f = this.f;
      f[o] = x; f[o + 1] = y; f[o + 2] = z; f[o + 3] = nx; f[o + 4] = ny; f[o + 5] = nz;
      this.b[bo] = r * 255 > 255 ? 255 : r * 255; this.b[bo + 1] = g * 255 > 255 ? 255 : g * 255;
      this.b[bo + 2] = b * 255 > 255 ? 255 : b * 255; this.b[bo + 3] = e * 255;
      f[o + 7] = u; f[o + 8] = w;
      return this.n++;
    }
    quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); }
    // append another builder's geometry transformed by position + yaw (around Y) + uniform scale
    append(src, x, y, z, yaw = 0, s = 1, tint = null) {
      const c = Math.cos(yaw), sn = Math.sin(yaw), base = this.n;
      this.grow(src.n);
      const f = src.f, sb = src.b;
      for (let i = 0; i < src.n; i++) {
        const o = i * 9, bo = i * STRIDE + 24;
        const lx = f[o] * s, ly = f[o + 1] * s, lz = f[o + 2] * s;
        const nx = f[o + 3], nz = f[o + 5];
        let r = sb[bo] / 255, g = sb[bo + 1] / 255, b = sb[bo + 2] / 255;
        if (tint) { r *= tint[0]; g *= tint[1]; b *= tint[2]; }
        this.v(x + lx * c + lz * sn, y + ly, z - lx * sn + lz * c, nx * c + nz * sn, f[o + 4], -nx * sn + nz * c, r, g, b, sb[bo + 3] / 255, f[o + 7], f[o + 8]);
      }
      for (const i of src.idx) this.idx.push(i + base);
    }
  }
  G.Builder = Builder;

  G.upload = function (gl, bld, dynamic = false) {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(bld.buf, 0, bld.n * STRIDE), dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, STRIDE, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, STRIDE, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, STRIDE, 24);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 2, gl.FLOAT, false, STRIDE, 28);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(bld.idx), dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, vb, ib, count: bld.idx.length };
  };
  // refill a dynamic mesh (particles, skid marks)
  G.refill = function (gl, mesh, bld) {
    gl.bindVertexArray(mesh.vao); // element buffer binding belongs to the VAO
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(bld.buf, 0, bld.n * STRIDE), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(bld.idx), gl.DYNAMIC_DRAW);
    mesh.count = bld.idx.length;
  };
  G.free = function (gl, mesh) {
    if (!mesh) return;
    gl.deleteBuffer(mesh.vb); gl.deleteBuffer(mesh.ib); gl.deleteVertexArray(mesh.vao);
  };

  G.texture = function (gl, src, opts = {}) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    const filt = opts.linear ? gl.LINEAR : gl.NEAREST;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, opts.mip ? gl.NEAREST_MIPMAP_LINEAR : filt);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filt);
    const wrap = opts.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    if (opts.mip) gl.generateMipmap(gl.TEXTURE_2D);
    return t;
  };

  // colour render target (optionally with a depth buffer)
  G.target = function (gl, w, h, opts = {}) {
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    const hf = opts.hdr && G.hdrOK;
    gl.texImage2D(gl.TEXTURE_2D, 0, hf ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, hf ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    let depth = null;
    if (opts.depth) {
      depth = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fb, depth, w, h };
  };
  G.freeTarget = function (gl, t) { if (!t) return; gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); if (t.depth) gl.deleteRenderbuffer(t.depth); };

  G.shadowTarget = function (gl, size) {
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, size, size, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0);
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fb, size };
  };

  // ---------------------------------------------------------------------------
  // Voxel models. A model is a grid (x forward, y up, z sideways) of packed colours.
  // Colour value: 0 = empty, else 0xEERRGGBB with EE = emissive (0..255) + 1 marker bit.
  // ---------------------------------------------------------------------------
  class Vox {
    constructor(sx, sy, sz) { this.sx = sx; this.sy = sy; this.sz = sz; this.d = new Float32Array(sx * sy * sz * 4); this.solid = new Uint8Array(sx * sy * sz); }
    i(x, y, z) { return (x * this.sy + y) * this.sz + z; }
    in(x, y, z) { return x >= 0 && y >= 0 && z >= 0 && x < this.sx && y < this.sy && z < this.sz; }
    set(x, y, z, c, e = 0) {
      x |= 0; y |= 0; z |= 0;
      if (!this.in(x, y, z)) return;
      const i = this.i(x, y, z); this.solid[i] = 1;
      this.d[i * 4] = c[0]; this.d[i * 4 + 1] = c[1]; this.d[i * 4 + 2] = c[2]; this.d[i * 4 + 3] = e;
    }
    clear(x, y, z) { if (this.in(x, y, z)) this.solid[this.i(x, y, z)] = 0; }
    has(x, y, z) { return this.in(x, y, z) && this.solid[this.i(x, y, z)] === 1; }
    box(x0, y0, z0, x1, y1, z1, c, e = 0, jit = 0, rnd = Math.random) {
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
        const k = 1 + (rnd() - 0.5) * jit; this.set(x, y, z, [c[0] * k, c[1] * k, c[2] * k], e);
      }
    }
  }
  G.Vox = Vox;

  const AO = [0.52, 0.68, 0.84, 1];
  const CORN = [[0, 0], [1, 0], [1, 1], [0, 1]];
  // Turn a voxel grid into a mesh builder. vs = voxel size; origin (ox,oy,oz) in voxels is placed at 0,0,0.
  G.mesh = function (vox, vs, ox = vox.sx / 2, oy = 0, oz = vox.sz / 2, bld = new Builder(2048)) {
    const p = [0, 0, 0], q = [0, 0, 0];
    for (let x = 0; x < vox.sx; x++) for (let y = 0; y < vox.sy; y++) for (let z = 0; z < vox.sz; z++) {
      const i = vox.i(x, y, z);
      if (!vox.solid[i]) continue;
      const r = vox.d[i * 4], g = vox.d[i * 4 + 1], b = vox.d[i * 4 + 2], e = vox.d[i * 4 + 3];
      for (let a = 0; a < 3; a++) for (let s = -1; s <= 1; s += 2) {
        p[0] = x; p[1] = y; p[2] = z; p[a] += s;
        if (vox.has(p[0], p[1], p[2])) continue;
        const u = (a + 1) % 3, v = (a + 2) % 3;
        const n = [0, 0, 0]; n[a] = s;
        const ids = [], aos = [];
        for (const [cu, cv] of CORN) {
          q[0] = x; q[1] = y; q[2] = z; q[a] += s > 0 ? 1 : 0; q[u] += cu; q[v] += cv;
          // AO: neighbours in the layer just outside this face
          const du = cu ? 1 : -1, dv = cv ? 1 : -1;
          const b1 = [p[0], p[1], p[2]]; b1[u] += du;
          const b2 = [p[0], p[1], p[2]]; b2[v] += dv;
          const b3 = [p[0], p[1], p[2]]; b3[u] += du; b3[v] += dv;
          const s1 = vox.has(b1[0], b1[1], b1[2]) ? 1 : 0, s2 = vox.has(b2[0], b2[1], b2[2]) ? 1 : 0, s3 = vox.has(b3[0], b3[1], b3[2]) ? 1 : 0;
          const ao = AO[s1 && s2 ? 0 : 3 - (s1 + s2 + s3)];
          const k = e > 0 ? Math.max(ao, 0.9) : ao;
          aos.push(ao);
          ids.push(bld.v((q[0] - ox) * vs, (q[1] - oy) * vs, (q[2] - oz) * vs, n[0], n[1], n[2], r * k, g * k, b * k, e));
        }
        if (aos[0] + aos[2] > aos[1] + aos[3]) bld.quad(ids[0], ids[1], ids[2], ids[3]);
        else bld.quad(ids[1], ids[2], ids[3], ids[0]);
      }
    }
    return bld;
  };

  CR.G = G;
})(window.CR);
