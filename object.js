"use strict";

/* ===== Globals ===== */
var canvas, gl, program;
var positions = [],
  colors = [];
var cBuffer, vBuffer;

// palette 16 warna + nama
const colorNames = [
  "Merah",
  "Hijau",
  "Biru",
  "Kuning",
  "Magenta",
  "Cyan",
  "Abu-abu",
  "Oranye",
  "Ungu Tua",
  "Kuning Gelap",
  "Cyan Gelap",
  "Hijau Muda",
  "Cokelat",
  "Aqua",
  "Pink",
  "Merah Muda Tua",
];
const colorPalette = [
  vec4(1, 0, 0, 1), // Merah terang (Red)
  vec4(0, 1, 0, 1), // Hijau terang (Green)
  vec4(0, 0, 1, 1), // Biru terang (Blue)
  vec4(1, 1, 0, 1), // Kuning (Yellow)
  vec4(1, 0, 1, 1), // Magenta / Fuchsia
  vec4(0, 1, 1, 1), // Cyan / Aqua
  vec4(0.5, 0.5, 0.5, 1), // Abu-abu sedang (Gray)
  vec4(1, 0.5, 0, 1), // Oranye (Orange)
  vec4(0.5, 0, 0.5, 1), // Ungu Tua (Purple)
  vec4(0.5, 0.5, 0, 1), // Zaitun / Kuning Gelap (Olive)
  vec4(0, 0.5, 0.5, 1), // Teal / Hijau Kebiruan
  vec4(0.3, 0.7, 0.2, 1), // Hijau Daun (Leaf Green)
  vec4(0.7, 0.3, 0.2, 1), // Cokelat / Merah Bata (Brown)
  vec4(0.2, 0.7, 0.7, 1), // Aqua Lembut / Cyan Muda
  vec4(0.7, 0.2, 0.7, 1), // Ungu Muda / Lavender
  vec4(0.9, 0.4, 0.4, 1), // Merah Muda Tua / Salmon
];

// faceColors: 18 sisi (6 top + 6 leg + 6 base)
var faceColors = [];
for (let i = 0; i < 18; i++)
  faceColors.push(colorPalette[i % colorPalette.length]);

/* ===== Build table vertices (3 cuboids) ===== */
function createCube(x, y, z, w, h, d) {
  return [
    vec4(x - w / 2, y - h / 2, z + d / 2, 1.0),
    vec4(x - w / 2, y + h / 2, z + d / 2, 1.0),
    vec4(x + w / 2, y + h / 2, z + d / 2, 1.0),
    vec4(x + w / 2, y - h / 2, z + d / 2, 1.0),
    vec4(x - w / 2, y - h / 2, z - d / 2, 1.0),
    vec4(x - w / 2, y + h / 2, z - d / 2, 1.0),
    vec4(x + w / 2, y + h / 2, z - d / 2, 1.0),
    vec4(x + w / 2, y - h / 2, z - d / 2, 1.0),
  ];
}
var vertices = (function buildTableVertices() {
  var arr = [];
  var top = createCube(0.0, 0.9, 0.0, 1.6, 0.15, 1.1);
  var leg = createCube(0.0, 0.45, 0.0, 0.4, 0.7, 0.4);
  var base = createCube(0.0, 0.05, 0.0, 0.8, 0.12, 0.8);
  return arr.concat(top, leg, base);
})();

/* ===== Transform / control state (kept from cube3) ===== */
var theta = [0, 0, 0];
var alpha = 1.0;
var scaleFactor = 1.0;
var translateVec = [0.0, -0.45, 0.0]; // dipindahkan sedikit turun supaya meja lebih terpusat
var rotationMode = "none";
var rotationSpeed = 0.0;

var thetaLoc, alphaLoc, projLoc, modelLoc;

/* ===== Build vertex & color arrays (once) =====
   Face ordering must be consistent with updateColors()
   We'll build arrays for 16 faces:
     - top (6 faces)
     - leg (4 side faces)
     - base (6 faces)
   total faces = 16, each face 6 vertices => 96 vertices
*/
function quad(a, b, c, d, col) {
  const idx = [a, b, c, a, c, d];
  for (let k = 0; k < idx.length; k++) {
    positions.push(vertices[idx[k]]);
    colors.push(col);
  }
}

function buildInitialArrays() {
  positions.length = 0;
  colors.length = 0;
  const faces = [
    [1, 0, 3, 2],
    [2, 3, 7, 6],
    [3, 0, 4, 7],
    [6, 5, 1, 2],
    [4, 5, 6, 7],
    [5, 4, 0, 1],
  ];
  let fi = 0;
  let offset = 0;

  // top: 6 faces
  faces.forEach((f) => {
    quad(
      offset + f[0],
      offset + f[1],
      offset + f[2],
      offset + f[3],
      faceColors[fi++]
    );
  });
  offset += 8;

  // leg: 6 faces (semua sisi)
  faces.forEach((f) => {
    quad(
      offset + f[0],
      offset + f[1],
      offset + f[2],
      offset + f[3],
      faceColors[fi++]
    );
  });
  offset += 8;

  // base: 6 faces
  faces.forEach((f) => {
    quad(
      offset + f[0],
      offset + f[1],
      offset + f[2],
      offset + f[3],
      faceColors[fi++]
    );
  });
}

/* ===== updateColors: only update color buffer (no vertex pointer rebinding) ===== */
function updateColorsBuffer() {
  let newColors = [];
  const faces = [
    [1, 0, 3, 2],
    [2, 3, 7, 6],
    [3, 0, 4, 7],
    [6, 5, 1, 2],
    [4, 5, 6, 7],
    [5, 4, 0, 1],
  ];
  let fi = 0;
  let offset = 0;

  // top
  faces.forEach(() => {
    for (let k = 0; k < 6; k++) newColors.push(faceColors[fi]);
    fi++;
  });
  offset += 8;

  // leg
  faces.forEach(() => {
    for (let k = 0; k < 6; k++) newColors.push(faceColors[fi]);
    fi++;
  });
  offset += 8;

  // base
  faces.forEach(() => {
    for (let k = 0; k < 6; k++) newColors.push(faceColors[fi]);
    fi++;
  });

  gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(newColors));
  colors = newColors.slice();
}

/* ===== Helper equalColor ===== */
function equalColor(a, b) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

/* ===== Resize handling ===== */
function resizeCanvasToDisplaySize() {
  const width = canvas.clientWidth | 0;
  const height = canvas.clientHeight | 0;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
}

/* ===== init & UI wiring ===== */
function init() {
  canvas = document.getElementById("gl-canvas");
  // make the canvas size match CSS layout
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  gl = canvas.getContext("webgl2");
  if (!gl) {
    alert("WebGL2 not available");
    return;
  }

  // build initial vertex/color arrays
  buildInitialArrays();

  // compile + use shaders
  program = initShaders(gl, "vertex-shader", "fragment-shader");
  gl.useProgram(program);

  // create and fill color buffer (DYNAMIC_DRAW so bufferSubData is ok)
  cBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.DYNAMIC_DRAW);
  var colorLoc = gl.getAttribLocation(program, "aColor");
  gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(colorLoc);

  // create and fill position buffer
  vBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(positions), gl.STATIC_DRAW);
  var posLoc = gl.getAttribLocation(program, "aPosition");
  gl.vertexAttribPointer(posLoc, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(posLoc);

  // uniforms
  thetaLoc = gl.getUniformLocation(program, "uTheta");
  alphaLoc = gl.getUniformLocation(program, "uAlpha");
  projLoc = gl.getUniformLocation(program, "uProjection");
  modelLoc = gl.getUniformLocation(program, "uModelMatrix");

  // GL state
  gl.clearColor(0.8, 0.8, 0.8, 1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // UI bindings (kept from cube3)
  document.getElementById("alphaSlider").oninput = (e) => {
    alpha = parseFloat(e.target.value);
    document.getElementById("alphaValue").textContent = alpha.toFixed(1);
  };
  document.getElementById("btnSmaller").onclick = () => {
    if (scaleFactor > 0.2) {
      scaleFactor = Math.max(0.2, scaleFactor - 0.2);
      document.getElementById("scaleValue").textContent =
        scaleFactor.toFixed(1);
    }
  };
  document.getElementById("btnBigger").onclick = () => {
    if (scaleFactor < 2.0) {
      scaleFactor = Math.min(2.0, scaleFactor + 0.2);
      document.getElementById("scaleValue").textContent =
        scaleFactor.toFixed(1);
    }
  };
  document.getElementById("btnLeft").onclick = () => (translateVec[0] -= 0.2);
  document.getElementById("btnRight").onclick = () => (translateVec[0] += 0.2);
  document.getElementById("btnUp").onclick = () => (translateVec[1] += 0.2);
  document.getElementById("btnDown").onclick = () => (translateVec[1] -= 0.2);
  document.getElementById("btnNoRotate").onclick = () =>
    (rotationMode = "none");
  document.getElementById("btnRotateX").onclick = () => (rotationMode = "x");
  document.getElementById("btnRotateY").onclick = () => (rotationMode = "y");
  document.getElementById("btnRotateXY").onclick = () => (rotationMode = "xy");
  document.getElementById("speedSlider").oninput = (e) => {
    rotationSpeed = parseFloat(e.target.value);
    document.getElementById("speedValue").textContent =
      rotationSpeed.toFixed(1);
  };

  // create 18 dropdown controls, dikelompokkan: cube atas, tengah, bawah
  const container = document.getElementById("faceColorControls");
  container.innerHTML = "";

  // helper buat section
  function addSection(title) {
    const h = document.createElement("h5");
    h.textContent = title;
    container.appendChild(h);
  }

  function addFaceControl(i, col) {
    const row = document.createElement("div");
    row.className = "face-row";
    const label = document.createElement("span");
    label.textContent = `Sisi ${i + 1}`;
    const select = document.createElement("select");
    colorNames.forEach((name, idx) => {
      const opt = document.createElement("option");
      opt.value = idx;
      opt.textContent = name;
      if (equalColor(col, colorPalette[idx])) opt.selected = true;
      select.appendChild(opt);
    });
    select.onchange = () => {
      faceColors[i] = colorPalette[parseInt(select.value)];
      updateColorsBuffer();
    };
    row.appendChild(label);
    row.appendChild(select);
    container.appendChild(row);
  }

  // Cube Atas (sisi 1–6)
  addSection("Cube Atas:");
  for (let i = 0; i < 6; i++) addFaceControl(i, faceColors[i]);

  // Cube Tengah (sisi 7–12)
  addSection("Cube Tengah:");
  for (let i = 6; i < 12; i++) addFaceControl(i, faceColors[i]);

  // Cube Bawah (sisi 13–18)
  addSection("Cube Bawah:");
  for (let i = 12; i < 18; i++) addFaceControl(i, faceColors[i]);

  // resize handling
  window.addEventListener("resize", () => {
    resizeCanvasToDisplaySize();
  });

  // ensure viewport correct
  resizeCanvasToDisplaySize();

  // start render loop
  requestAnimationFrame(render);
}

/* ===== Render ===== */
function render(time) {
  resizeCanvasToDisplaySize();

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  if (rotationMode === "x") theta[1] += rotationSpeed;
  if (rotationMode === "y") theta[0] += rotationSpeed;
  if (rotationMode === "xy") {
    theta[0] += rotationSpeed;
    theta[1] += rotationSpeed;
  }

  var aspect = canvas.width / canvas.height;
  var projection = ortho(-aspect, aspect, -1, 1, -1, 1);
  var t = translateMatrix(translateVec[0], translateVec[1], translateVec[2]);
  var s = scalem(scaleFactor, scaleFactor, scaleFactor);
  var modelMatrix = mult(t, s);

  gl.uniform3fv(thetaLoc, theta);
  gl.uniform1f(alphaLoc, alpha);
  gl.uniformMatrix4fv(projLoc, false, flatten(projection));
  gl.uniformMatrix4fv(modelLoc, false, flatten(modelMatrix));

  gl.drawArrays(gl.TRIANGLES, 0, positions.length);

  requestAnimationFrame(render);
}

/* ===== utilities ===== */
function translateMatrix(x, y, z) {
  return mat4(1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1);
}
function scalem(x, y, z) {
  return mat4(x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1);
}

/* ===== start ===== */
window.onload = init;
