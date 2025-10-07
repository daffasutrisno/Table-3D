"use strict";

var canvas, gl, program;
var positions = [],
  colors = [];
var cBuffer, vBuffer;

// Grid variables - NEW
var gridPositions = [],
  gridColors = [];
var gridBuffer, gridColorBuffer;
var gridSize = 10;
var gridSpacing = 0.5;
// gridY will be computed so the table sits on the grid initially
var gridY = 0.0;

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
  vec4(1, 0, 0, 1),
  vec4(0, 1, 0, 1),
  vec4(0, 0, 1, 1),
  vec4(1, 1, 0, 1),
  vec4(1, 0, 1, 1),
  vec4(0, 1, 1, 1),
  vec4(0.5, 0.5, 0.5, 1),
  vec4(1, 0.5, 0, 1),
  vec4(0.5, 0, 0.5, 1),
  vec4(0.5, 0.5, 0, 1),
  vec4(0, 0.5, 0.5, 1),
  vec4(0.3, 0.7, 0.2, 1),
  vec4(0.7, 0.3, 0.2, 1),
  vec4(0.2, 0.7, 0.7, 1),
  vec4(0.7, 0.2, 0.7, 1),
  vec4(0.9, 0.4, 0.4, 1),
];

// faceColors: 18 sisi (6 top + 6 leg + 6 base)
var faceColors = [];
for (let i = 0; i < 18; i++)
  faceColors.push(colorPalette[i % colorPalette.length]);

// Build table vertices (3 cuboids)
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

// Transform variables
var theta = [0, 0, 0];
var alpha = 1.0;
var scaleFactor = 1.0;
var translateVec = [0.0, -0.45, 0.0];
var rotationMode = "none";
var rotationSpeed = 0.0;

// Camera variables - NEW
var cameraRadius = 3.0;
var cameraTheta = 0.0; // horizontal angle
var cameraPhi = Math.PI / 4; // vertical angle
var cameraTarget = vec3(0.0, 0.0, 0.0);
var cameraUp = vec3(0.0, 1.0, 0.0);
var projectionType = "perspective"; // "perspective" or "orthographic"
var fovy = 45.0;
var near = 0.1;
var far = 10.0;
var showGrid = true; // NEW - Grid visibility toggle

// Mouse interaction - NEW
var mouseDown = false;
var lastMouseX = 0;
var lastMouseY = 0;

// Uniform locations
var thetaLoc, alphaLoc, projLoc, modelLoc, modelViewLoc;

// Build grid - NEW
function buildGrid() {
  gridPositions = [];
  gridColors = [];

  var halfSize = (gridSize * gridSpacing) / 2;
  var gridColor = vec4(0.3, 0.3, 0.3, 0.8); // Gray color for grid
  var axisColorX = vec4(1.0, 0.3, 0.3, 1.0); // Red for X axis
  var axisColorZ = vec4(0.3, 0.3, 1.0, 1.0); // Blue for Z axis

  // Create grid lines
  for (let i = 0; i <= gridSize; i++) {
    var offset = i * gridSpacing - halfSize;

    // Horizontal lines (parallel to X axis)
    var color = i === Math.floor(gridSize / 2) ? axisColorX : gridColor;
    gridPositions.push(vec4(-halfSize, gridY, offset, 1.0));
    gridPositions.push(vec4(halfSize, gridY, offset, 1.0));
    gridColors.push(color);
    gridColors.push(color);

    // Vertical lines (parallel to Z axis)
    color = i === Math.floor(gridSize / 2) ? axisColorZ : gridColor;
    gridPositions.push(vec4(offset, gridY, -halfSize, 1.0));
    gridPositions.push(vec4(offset, gridY, halfSize, 1.0));
    gridColors.push(color);
    gridColors.push(color);
  }
}

// compute minimum Y from a simple array of vec4 or vec3 vertices (local/object coords)
function findMinVertexY(arr) {
  if (!arr || arr.length === 0) return 0.0;
  var minY = arr[0][1];
  for (var i = 1; i < arr.length; i++) {
    if (arr[i][1] < minY) minY = arr[i][1];
  }
  return minY;
}
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

  // leg: 6 faces
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

// update color buffer
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

  // top + leg + base
  for (let cube = 0; cube < 3; cube++) {
    faces.forEach(() => {
      for (let k = 0; k < 6; k++) newColors.push(faceColors[fi]);
      fi++;
    });
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(newColors));
  colors = newColors.slice();
}

// Helper equalColor
function equalColor(a, b) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

// Calculate camera position - NEW
function getCameraPosition() {
  var x = cameraRadius * Math.sin(cameraPhi) * Math.cos(cameraTheta);
  var y = cameraRadius * Math.cos(cameraPhi);
  var z = cameraRadius * Math.sin(cameraPhi) * Math.sin(cameraTheta);
  return vec3(x, y, z);
}

// Mouse event handlers - NEW
function handleMouseDown(event) {
  mouseDown = true;
  lastMouseX = event.clientX;
  lastMouseY = event.clientY;
  canvas.style.cursor = "grabbing";
}

function handleMouseUp(event) {
  mouseDown = false;
  canvas.style.cursor = "grab";
}

function handleMouseMove(event) {
  if (!mouseDown) return;

  var deltaX = event.clientX - lastMouseX;
  var deltaY = event.clientY - lastMouseY;

  cameraTheta += deltaX * 0.01;
  cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraPhi + deltaY * 0.01));

  lastMouseX = event.clientX;
  lastMouseY = event.clientY;
}

function handleWheel(event) {
  event.preventDefault();
  cameraRadius = Math.max(
    1.0,
    Math.min(10.0, cameraRadius + event.deltaY * 0.01)
  );
}

// Resize handling
function resizeCanvasToDisplaySize() {
  const width = canvas.clientWidth | 0;
  const height = canvas.clientHeight | 0;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
}

// init & UI wiring
function init() {
  canvas = document.getElementById("gl-canvas");
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  canvas.style.cursor = "grab";

  gl = canvas.getContext("webgl2");
  if (!gl) {
    alert("WebGL2 not available");
    return;
  }

  buildInitialArrays();
  // Compute object bottom and position so it rests on the grid
  var localMinY = findMinVertexY(vertices);
  // We want the lowest world Y to be slightly above the grid (grid at y=0)
  // initial scale is 1.0, so worldMinY = localMinY + translateVec[1]
  // set translateVec[1] so worldMinY == 0.01 (tiny offset)
  translateVec[1] = 0.01 - localMinY;
  gridY = 0.0; // keep grid at y=0
  buildGrid(); // NEW - Build grid

  program = initShaders(gl, "vertex-shader", "fragment-shader");
  gl.useProgram(program);

  // create and fill color buffer
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

  // NEW - Create grid buffers
  gridBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, gridBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(gridPositions), gl.STATIC_DRAW);

  gridColorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, gridColorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(gridColors), gl.STATIC_DRAW);

  // uniforms
  thetaLoc = gl.getUniformLocation(program, "uTheta");
  alphaLoc = gl.getUniformLocation(program, "uAlpha");
  projLoc = gl.getUniformLocation(program, "uProjection");
  modelLoc = gl.getUniformLocation(program, "uModelMatrix");
  modelViewLoc = gl.getUniformLocation(program, "uModelViewMatrix");

  // GL state
  gl.clearColor(0.8, 0.8, 0.8, 1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // Mouse events - NEW
  canvas.addEventListener("mousedown", handleMouseDown);
  canvas.addEventListener("mouseup", handleMouseUp);
  canvas.addEventListener("mousemove", handleMouseMove);
  canvas.addEventListener("wheel", handleWheel);

  // Original UI bindings
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

  // NEW Grid Controls
  document.getElementById("gridToggle").onchange = (e) => {
    showGrid = e.target.checked;
  };
  document.getElementById("gridSizeSlider").oninput = (e) => {
    gridSize = parseInt(e.target.value);
    document.getElementById("gridSizeValue").textContent = gridSize;
    buildGrid();
    // Update grid buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, gridBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(gridPositions), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, gridColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(gridColors), gl.STATIC_DRAW);
  };
  document.getElementById("gridSpacingSlider").oninput = (e) => {
    gridSpacing = parseFloat(e.target.value);
    document.getElementById("gridSpacingValue").textContent =
      gridSpacing.toFixed(1);
    buildGrid();
    // Update grid buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, gridBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(gridPositions), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, gridColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(gridColors), gl.STATIC_DRAW);
  };

  // NEW Camera Controls
  document.getElementById("projectionSelect").onchange = (e) => {
    projectionType = e.target.value;
  };
  document.getElementById("fovSlider").oninput = (e) => {
    fovy = parseFloat(e.target.value);
    document.getElementById("fovValue").textContent = fovy.toFixed(0) + "°";
  };
  document.getElementById("radiusSlider").oninput = (e) => {
    cameraRadius = parseFloat(e.target.value);
    document.getElementById("radiusValue").textContent =
      cameraRadius.toFixed(1);
  };
  document.getElementById("btnResetCamera").onclick = () => {
    cameraRadius = 3.0;
    cameraTheta = 0.0;
    cameraPhi = Math.PI / 4;
    document.getElementById("radiusValue").textContent =
      cameraRadius.toFixed(1);
    document.getElementById("radiusSlider").value = cameraRadius;
  };

  // Create preset view buttons
  document.getElementById("btnFrontView").onclick = () => {
    cameraTheta = 0.0;
    cameraPhi = Math.PI / 2;
  };
  document.getElementById("btnTopView").onclick = () => {
    cameraTheta = 0.0;
    cameraPhi = 0.1;
  };
  document.getElementById("btnSideView").onclick = () => {
    cameraTheta = Math.PI / 2;
    cameraPhi = Math.PI / 2;
  };
  document.getElementById("btnIsometricView").onclick = () => {
    cameraTheta = Math.PI / 4;
    cameraPhi = Math.PI / 4;
  };

  // create 18 dropdown controls
  const container = document.getElementById("faceColorControls");
  container.innerHTML = "";

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

  addSection("Cube Atas:");
  for (let i = 0; i < 6; i++) addFaceControl(i, faceColors[i]);
  addSection("Cube Tengah:");
  for (let i = 6; i < 12; i++) addFaceControl(i, faceColors[i]);
  addSection("Cube Bawah:");
  for (let i = 12; i < 18; i++) addFaceControl(i, faceColors[i]);

  window.addEventListener("resize", resizeCanvasToDisplaySize);
  resizeCanvasToDisplaySize();
  requestAnimationFrame(render);
}

function render(time) {
  resizeCanvasToDisplaySize();
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Object rotation
  if (rotationMode === "x") theta[1] += rotationSpeed;
  if (rotationMode === "y") theta[0] += rotationSpeed;
  if (rotationMode === "xy") {
    theta[0] += rotationSpeed;
    theta[1] += rotationSpeed;
  }

  // Calculate camera position and create view matrix
  var cameraPosition = getCameraPosition();
  var modelViewMatrix = lookAt(cameraPosition, cameraTarget, cameraUp);

  // Create projection matrix
  var aspect = canvas.width / canvas.height;
  var projectionMatrix;
  if (projectionType === "perspective") {
    projectionMatrix = perspective(fovy, aspect, near, far);
  } else {
    var size = cameraRadius * 0.5;
    projectionMatrix = ortho(
      -size * aspect,
      size * aspect,
      -size,
      size,
      near,
      far
    );
  }

  // NEW - Render Grid First (if enabled)
  if (showGrid) {
    // Bind grid buffers
    gl.bindBuffer(gl.ARRAY_BUFFER, gridBuffer);
    var posLoc = gl.getAttribLocation(program, "aPosition");
    gl.vertexAttribPointer(posLoc, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(posLoc);

    gl.bindBuffer(gl.ARRAY_BUFFER, gridColorBuffer);
    var colorLoc = gl.getAttribLocation(program, "aColor");
    gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(colorLoc);

    // Set uniforms for grid (no object transformations)
    gl.uniform3fv(thetaLoc, [0, 0, 0]); // No rotation for grid
    gl.uniform1f(alphaLoc, 1.0); // Full opacity for grid
    gl.uniformMatrix4fv(projLoc, false, flatten(projectionMatrix));
    gl.uniformMatrix4fv(modelLoc, false, flatten(mat4())); // Identity matrix
    if (modelViewLoc) {
      gl.uniformMatrix4fv(modelViewLoc, false, flatten(modelViewMatrix));
    }

    // Draw grid as lines
    gl.drawArrays(gl.LINES, 0, gridPositions.length);
  }

  // Render Table Object
  // Bind table object buffers
  gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
  var colorLoc = gl.getAttribLocation(program, "aColor");
  gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(colorLoc);

  gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
  var posLoc = gl.getAttribLocation(program, "aPosition");
  gl.vertexAttribPointer(posLoc, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(posLoc);

  // Model transformations for table
  var t = translateMatrix(translateVec[0], translateVec[1], translateVec[2]);
  var s = scalem(scaleFactor, scaleFactor, scaleFactor);
  var modelMatrix = mult(t, s);

  // Send uniforms for table
  gl.uniform3fv(thetaLoc, theta);
  gl.uniform1f(alphaLoc, alpha);
  gl.uniformMatrix4fv(projLoc, false, flatten(projectionMatrix));
  gl.uniformMatrix4fv(modelLoc, false, flatten(modelMatrix));
  if (modelViewLoc) {
    gl.uniformMatrix4fv(modelViewLoc, false, flatten(modelViewMatrix));
  }

  // Draw table
  gl.drawArrays(gl.TRIANGLES, 0, positions.length);
  requestAnimationFrame(render);
}

function translateMatrix(x, y, z) {
  return mat4(1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1);
}

function scalem(x, y, z) {
  return mat4(x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1);
}

window.onload = init;
