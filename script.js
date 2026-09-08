import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/* ============================================================
   1. ELEMENT DATA (CPK-style colors + covalent radii, simplified)
   ============================================================ */
const ELEMENTS = {
  H:  { color: 0xffffff, radius: 0.32, name: "Vodík" },
  O:  { color: 0xff3b30, radius: 0.55, name: "Kyslík" },
  C:  { color: 0x4a4a4a, radius: 0.60, name: "Uhlík" },
  N:  { color: 0x3b82f6, radius: 0.58, name: "Dusík" },
};

/* ============================================================
   2. MOLECULE LIBRARY
   Each molecule: metadata + atoms (element, x, y, z) + bonds (index pairs)
   Coordinates are illustrative, not lab-precise.
   ============================================================ */
const MOLECULES = {
  water: {
    name: "Voda (Water)",
    formula: "H₂O",
    mass: "18.015 g/mol",
    geometry: "Lomená (VSEPR)",
    angle: "104.5°",
    atoms: [
      { el: "O", pos: [0, 0, 0] },
      { el: "H", pos: [0.76, 0.59, 0] },
      { el: "H", pos: [-0.76, 0.59, 0] },
    ],
    bonds: [[0, 1], [0, 2]],
  },
  co2: {
    name: "Oxid uhličitý",
    formula: "CO₂",
    mass: "44.01 g/mol",
    geometry: "Lineární (VSEPR)",
    angle: "180°",
    atoms: [
      { el: "C", pos: [0, 0, 0] },
      { el: "O", pos: [1.16, 0, 0] },
      { el: "O", pos: [-1.16, 0, 0] },
    ],
    bonds: [[0, 1], [0, 2]],
  },
  methane: {
    name: "Metan",
    formula: "CH₄",
    mass: "16.04 g/mol",
    geometry: "Tetraedrická (VSEPR)",
    angle: "109.5°",
    atoms: [
      { el: "C", pos: [0, 0, 0] },
      { el: "H", pos: [0.63, 0.63, 0.63] },
      { el: "H", pos: [-0.63, -0.63, 0.63] },
      { el: "H", pos: [-0.63, 0.63, -0.63] },
      { el: "H", pos: [0.63, -0.63, -0.63] },
    ],
    bonds: [[0, 1], [0, 2], [0, 3], [0, 4]],
  },
  ammonia: {
    name: "Amoniak",
    formula: "NH₃",
    mass: "17.03 g/mol",
    geometry: "Trigonální pyramida",
    angle: "107°",
    atoms: [
      { el: "N", pos: [0, 0.25, 0] },
      { el: "H", pos: [0.94, -0.2, 0] },
      { el: "H", pos: [-0.47, -0.2, 0.82] },
      { el: "H", pos: [-0.47, -0.2, -0.82] },
    ],
    bonds: [[0, 1], [0, 2], [0, 3]],
  },
};

/* ============================================================
   3. THREE.JS SCENE SETUP
   ============================================================ */
const viewportEl = document.getElementById("viewport");

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  45,
  viewportEl.clientWidth / viewportEl.clientHeight,
  0.1,
  100
);
camera.position.set(0, 0, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(viewportEl.clientWidth, viewportEl.clientHeight);
viewportEl.appendChild(renderer.domElement);

// Lighting
const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
keyLight.position.set(4, 5, 6);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x5588ff, 0.4);
rimLight.position.set(-5, -3, -4);
scene.add(rimLight);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 2;
controls.maxDistance = 15;

// Group that holds the current molecule (so we can clear/rebuild easily)
let moleculeGroup = new THREE.Group();
scene.add(moleculeGroup);

/* ============================================================
   4. BUILD / REBUILD MOLECULE IN THE SCENE
   ============================================================ */
function clearMolecule() {
  while (moleculeGroup.children.length) {
    const obj = moleculeGroup.children.pop();
    obj.geometry?.dispose();
    obj.material?.dispose();
  }
}

function elementInfo(symbol) {
  return ELEMENTS[symbol] || { color: 0xcccccc, radius: 0.4, name: symbol };
}

function buildMolecule(atoms, bonds) {
  clearMolecule();

  const positions = atoms.map((a) => new THREE.Vector3(...a.pos));

  // Atoms as spheres
  atoms.forEach((atom, i) => {
    const info = elementInfo(atom.el);
    const geometry = new THREE.SphereGeometry(info.radius, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: info.color,
      roughness: 0.35,
      metalness: 0.05,
    });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(positions[i]);
    moleculeGroup.add(sphere);
  });

  // Bonds as thin cylinders connecting atom centers
  bonds.forEach(([iA, iB]) => {
    const start = positions[iA];
    const end = positions[iB];
    const dir = new THREE.Vector3().subVectors(end, start);
    const length = dir.length();
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

    const bondGeom = new THREE.CylinderGeometry(0.08, 0.08, length, 12);
    const bondMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.5 });
    const bond = new THREE.Mesh(bondGeom, bondMat);

    bond.position.copy(mid);
    bond.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize()
    );
    moleculeGroup.add(bond);
  });

  // Re-center camera target on the molecule's bounding box
  const box = new THREE.Box3().setFromObject(moleculeGroup);
  const center = box.getCenter(new THREE.Vector3());
  controls.target.copy(center);
  controls.update();
}

/* ============================================================
   5. UI WIRING — side panel updates
   ============================================================ */
const propName = document.getElementById("prop-name");
const propFormula = document.getElementById("prop-formula");
const propMass = document.getElementById("prop-mass");
const propGeometry = document.getElementById("prop-geometry");
const propAngle = document.getElementById("prop-angle");
const legendList = document.getElementById("legend-list");
const moleculeSelect = document.getElementById("molecule-select");

function updatePanel(data) {
  propName.textContent = data.name;
  propFormula.textContent = data.formula;
  propMass.textContent = data.mass;
  propGeometry.textContent = data.geometry;
  propAngle.textContent = data.angle;
}

function updateLegend(atoms) {
  const usedSymbols = [...new Set(atoms.map((a) => a.el))];
  legendList.innerHTML = "";
  usedSymbols.forEach((symbol) => {
    const info = elementInfo(symbol);
    const item = document.createElement("div");
    item.className = "legend-item";
    item.innerHTML = `
      <span class="legend-dot" style="background:#${info.color.toString(16).padStart(6, "0")}"></span>
      <span>${info.name} (${symbol})</span>
    `;
    legendList.appendChild(item);
  });
}

function loadMolecule(key) {
  const data = MOLECULES[key];
  if (!data) return;
  buildMolecule(data.atoms, data.bonds);
  updatePanel(data);
  updateLegend(data.atoms);
}

moleculeSelect.addEventListener("change", (e) => {
  loadMolecule(e.target.value);
  setUploadStatus("", "");
});

// Initial load
loadMolecule("water");

/* ============================================================
   6. .XYZ FILE IMPORT
   Standard XYZ format:
     line 1: atom count
     line 2: comment
     line 3+: Element  X  Y  Z
   ============================================================ */
const uploadBtn = document.getElementById("upload-btn");
const fileInput = document.getElementById("file-input");
const uploadStatus = document.getElementById("upload-status");

function setUploadStatus(msg, type) {
  uploadStatus.textContent = msg;
  uploadStatus.className = type || "";
}

uploadBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = parseXYZ(reader.result);
      buildMolecule(parsed.atoms, parsed.bonds);
      updatePanel({
        name: file.name.replace(/\.[^/.]+$/, ""),
        formula: "—",
        mass: "—",
        geometry: "—",
        angle: "—",
      });
      updateLegend(parsed.atoms);
      setUploadStatus(`Načteno: ${parsed.atoms.length} atomů`, "ok");
    } catch (err) {
      setUploadStatus("Chyba: " + err.message, "error");
    }
  };
  reader.onerror = () => setUploadStatus("Soubor se nepodařilo přečíst.", "error");
  reader.readAsText(file);
});

function parseXYZ(text) {
  const lines = text.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 3) throw new Error("Neplatný .xyz formát (příliš málo řádků).");

  const count = parseInt(lines[0], 10);
  if (isNaN(count)) throw new Error("První řádek musí obsahovat počet atomů.");

  const atomLines = lines.slice(2, 2 + count);
  if (atomLines.length < count) throw new Error("Počet atomů neodpovídá obsahu souboru.");

  const atoms = atomLines.map((line, idx) => {
    const parts = line.split(/\s+/);
    if (parts.length < 4) throw new Error(`Řádek ${idx + 3}: očekávány 4 hodnoty (prvek x y z).`);
    const [el, x, y, z] = parts;
    return { el, pos: [parseFloat(x), parseFloat(y), parseFloat(z)] };
  });

  // Naive auto-bonding: connect atoms closer than a distance threshold
  const bonds = [];
  const BOND_THRESHOLD = 1.7; // angstrom-ish, generous for a beginner project
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const dx = atoms[i].pos[0] - atoms[j].pos[0];
      const dy = atoms[i].pos[1] - atoms[j].pos[1];
      const dz = atoms[i].pos[2] - atoms[j].pos[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < BOND_THRESHOLD) bonds.push([i, j]);
    }
  }

  return { atoms, bonds };
}

/* ============================================================
   7. RENDER LOOP + RESIZE
   ============================================================ */
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
  const w = viewportEl.clientWidth;
  const h = viewportEl.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});
