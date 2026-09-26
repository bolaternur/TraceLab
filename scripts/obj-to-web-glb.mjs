import { createReadStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import path from "node:path";

const [, , inputPath, outputPath, rawResolution = "0", rawMaxFaces = "800000"] = process.argv;
if (!inputPath || !outputPath) {
  console.error("Usage: node scripts/obj-to-web-glb.mjs input.obj output.glb [gridResolution] [maxFaces]");
  process.exit(1);
}

const resolution = Math.max(0, Number.parseInt(rawResolution, 10) || 0);
const maxFaces = Math.max(1, Number.parseInt(rawMaxFaces, 10) || 800_000);

async function lines(file) {
  return createInterface({ input: createReadStream(file), crlfDelay: Infinity });
}

async function inspectObj(file) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let vertexCount = 0;
  for await (const line of await lines(file)) {
    if (!line.startsWith("v ")) continue;
    const values = line.trim().split(/\s+/);
    const xyz = [Number(values[1]), Number(values[2]), Number(values[3])];
    if (!xyz.every(Number.isFinite)) continue;
    vertexCount += 1;
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], xyz[axis]);
      max[axis] = Math.max(max[axis], xyz[axis]);
    }
  }
  return { min, max, vertexCount };
}

async function readMtl(objFile) {
  let mtllib = "";
  for await (const line of await lines(objFile)) {
    if (line.startsWith("mtllib ")) {
      mtllib = line.slice(7).trim();
      break;
    }
    if (line.startsWith("v ")) break;
  }
  if (!mtllib) return new Map();
  const text = await readFile(path.join(path.dirname(objFile), mtllib), "utf8").catch(() => "");
  const colors = new Map();
  let current = "";
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("newmtl ")) current = line.slice(7).trim();
    if (current && line.startsWith("Kd ")) {
      const rgb = line.slice(3).trim().split(/\s+/).map(Number);
      if (rgb.length === 3 && rgb.every(Number.isFinite)) colors.set(current, rgb);
    }
  }
  return colors;
}

function colorForMaterial(name, mtlColors) {
  if (mtlColors.has(name)) return mtlColors.get(name);
  const embedded = name.match(/Opaque\((\d+),(\d+),(\d+)\)/i);
  if (embedded) return embedded.slice(1).map((value) => Number(value) / 255);
  return [0.72, 0.76, 0.8];
}

function seededRandom() {
  let state = 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const info = await inspectObj(inputPath);
console.log(`OBJ: ${info.vertexCount.toLocaleString()} vertices; grid=${resolution || "off"}; face cap=${maxFaces.toLocaleString()}`);

const vertexMap = new Uint32Array(info.vertexCount + 1);
const sumsX = [];
const sumsY = [];
const sumsZ = [];
const counts = [];
const cells = new Map();
let sourceVertex = 0;

for await (const line of await lines(inputPath)) {
  if (!line.startsWith("v ")) continue;
  const values = line.trim().split(/\s+/);
  const x = Number(values[1]);
  const y = Number(values[2]);
  const z = Number(values[3]);
  sourceVertex += 1;
  let id;
  if (resolution > 1) {
    const cell = [x, y, z].map((value, axis) => {
      const span = info.max[axis] - info.min[axis] || 1;
      return Math.min(resolution - 1, Math.max(0, Math.floor(((value - info.min[axis]) / span) * (resolution - 1))));
    });
    const key = cell[0] * resolution * resolution + cell[1] * resolution + cell[2];
    id = cells.get(key);
    if (id === undefined) {
      id = sumsX.length;
      cells.set(key, id);
      sumsX.push(0);
      sumsY.push(0);
      sumsZ.push(0);
      counts.push(0);
    }
  } else {
    id = sumsX.length;
    sumsX.push(0);
    sumsY.push(0);
    sumsZ.push(0);
    counts.push(0);
  }
  vertexMap[sourceVertex] = id;
  sumsX[id] += x;
  sumsY[id] += y;
  sumsZ[id] += z;
  counts[id] += 1;
}

const positions = new Float32Array(sumsX.length * 3);
const positionMin = [Infinity, Infinity, Infinity];
const positionMax = [-Infinity, -Infinity, -Infinity];
for (let id = 0; id < sumsX.length; id += 1) {
  const xyz = [sumsX[id] / counts[id], sumsY[id] / counts[id], sumsZ[id] / counts[id]];
  for (let axis = 0; axis < 3; axis += 1) {
    positions[id * 3 + axis] = xyz[axis];
    positionMin[axis] = Math.min(positionMin[axis], xyz[axis]);
    positionMax[axis] = Math.max(positionMax[axis], xyz[axis]);
  }
}

const mtlColors = await readMtl(inputPath);
const materialNames = [];
const materialIds = new Map();
const materialId = (name) => {
  if (!materialIds.has(name)) {
    materialIds.set(name, materialNames.length);
    materialNames.push(name);
  }
  return materialIds.get(name);
};

let activeMaterial = materialId("Default");
let trianglesSeen = 0;
let trianglesKept = 0;
const reservoir = new Uint32Array(maxFaces * 4);
const random = seededRandom();

function keepTriangle(a, b, c, material) {
  if (a === b || b === c || a === c) return;
  const offsetA = a * 3;
  const offsetB = b * 3;
  const offsetC = c * 3;
  const abx = positions[offsetB] - positions[offsetA];
  const aby = positions[offsetB + 1] - positions[offsetA + 1];
  const abz = positions[offsetB + 2] - positions[offsetA + 2];
  const acx = positions[offsetC] - positions[offsetA];
  const acy = positions[offsetC + 1] - positions[offsetA + 1];
  const acz = positions[offsetC + 2] - positions[offsetA + 2];
  const nx = aby * acz - abz * acy;
  const ny = abz * acx - abx * acz;
  const nz = abx * acy - aby * acx;
  if (nx * nx + ny * ny + nz * nz < 1e-18) return;
  trianglesSeen += 1;
  let slot;
  if (trianglesKept < maxFaces) {
    slot = trianglesKept;
    trianglesKept += 1;
  } else {
    const candidate = Math.floor(random() * trianglesSeen);
    if (candidate >= maxFaces) return;
    slot = candidate;
  }
  const offset = slot * 4;
  reservoir[offset] = a;
  reservoir[offset + 1] = b;
  reservoir[offset + 2] = c;
  reservoir[offset + 3] = material;
}

for await (const line of await lines(inputPath)) {
  if (line.startsWith("usemtl ")) {
    activeMaterial = materialId(line.slice(7).trim());
    continue;
  }
  if (!line.startsWith("f ")) continue;
  const refs = line.trim().split(/\s+/).slice(1).map((token) => {
    const raw = Number.parseInt(token.split("/")[0], 10);
    const sourceId = raw < 0 ? info.vertexCount + raw + 1 : raw;
    return vertexMap[sourceId];
  });
  if (refs.length < 3 || refs.some((value) => value === undefined)) continue;
  for (let i = 1; i < refs.length - 1; i += 1) keepTriangle(refs[0], refs[i], refs[i + 1], activeMaterial);
}

const materialCounts = new Uint32Array(materialNames.length);
for (let i = 0; i < trianglesKept; i += 1) materialCounts[reservoir[i * 4 + 3]] += 3;
const materialStarts = new Uint32Array(materialNames.length);
for (let i = 1; i < materialStarts.length; i += 1) materialStarts[i] = materialStarts[i - 1] + materialCounts[i - 1];
const cursors = materialStarts.slice();
const indices = new Uint32Array(trianglesKept * 3);
for (let i = 0; i < trianglesKept; i += 1) {
  const offset = i * 4;
  const mat = reservoir[offset + 3];
  const cursor = cursors[mat];
  indices[cursor] = reservoir[offset];
  indices[cursor + 1] = reservoir[offset + 1];
  indices[cursor + 2] = reservoir[offset + 2];
  cursors[mat] += 3;
}

const normals = new Float32Array(positions.length);
for (let i = 0; i < indices.length; i += 3) {
  const a = indices[i] * 3;
  const b = indices[i + 1] * 3;
  const c = indices[i + 2] * 3;
  const abx = positions[b] - positions[a];
  const aby = positions[b + 1] - positions[a + 1];
  const abz = positions[b + 2] - positions[a + 2];
  const acx = positions[c] - positions[a];
  const acy = positions[c + 1] - positions[a + 1];
  const acz = positions[c + 2] - positions[a + 2];
  const nx = aby * acz - abz * acy;
  const ny = abz * acx - abx * acz;
  const nz = abx * acy - aby * acx;
  for (const offset of [a, b, c]) {
    normals[offset] += nx;
    normals[offset + 1] += ny;
    normals[offset + 2] += nz;
  }
}
for (let i = 0; i < normals.length; i += 3) {
  const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
  normals[i] /= length;
  normals[i + 1] /= length;
  normals[i + 2] /= length;
}

function padded(buffer) {
  const padding = (4 - (buffer.length % 4)) % 4;
  return padding ? Buffer.concat([buffer, Buffer.alloc(padding)]) : buffer;
}

const positionBuffer = padded(Buffer.from(positions.buffer));
const normalBuffer = padded(Buffer.from(normals.buffer));
const indexBuffer = padded(Buffer.from(indices.buffer));
const binary = Buffer.concat([positionBuffer, normalBuffer, indexBuffer]);
const indexOffset = positionBuffer.length + normalBuffer.length;

const materials = materialNames.map((name) => ({
  name,
  pbrMetallicRoughness: {
    baseColorFactor: [...colorForMaterial(name, mtlColors), 1],
    metallicFactor: name.includes("90,90,90") ? 0.72 : 0.28,
    roughnessFactor: 0.48,
  },
  doubleSided: true,
}));
const bufferViews = [
  { buffer: 0, byteOffset: 0, byteLength: positions.byteLength, target: 34962 },
  { buffer: 0, byteOffset: positionBuffer.length, byteLength: normals.byteLength, target: 34962 },
];
const accessors = [
  { bufferView: 0, componentType: 5126, count: positions.length / 3, type: "VEC3", min: positionMin, max: positionMax },
  { bufferView: 1, componentType: 5126, count: normals.length / 3, type: "VEC3" },
];
const primitives = [];
for (let mat = 0; mat < materialNames.length; mat += 1) {
  if (!materialCounts[mat]) continue;
  const view = bufferViews.length;
  bufferViews.push({ buffer: 0, byteOffset: indexOffset + materialStarts[mat] * 4, byteLength: materialCounts[mat] * 4, target: 34963 });
  const accessor = accessors.length;
  accessors.push({ bufferView: view, componentType: 5125, count: materialCounts[mat], type: "SCALAR" });
  primitives.push({ attributes: { POSITION: 0, NORMAL: 1 }, indices: accessor, material: mat, mode: 4 });
}

const gltf = {
  asset: { version: "2.0", generator: "TraceLab streaming OBJ optimizer" },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: path.basename(inputPath, path.extname(inputPath)) }],
  meshes: [{ name: path.basename(inputPath), primitives }],
  materials,
  buffers: [{ byteLength: binary.length }],
  bufferViews,
  accessors,
};
let jsonBuffer = Buffer.from(JSON.stringify(gltf));
const jsonPadding = (4 - (jsonBuffer.length % 4)) % 4;
if (jsonPadding) jsonBuffer = Buffer.concat([jsonBuffer, Buffer.alloc(jsonPadding, 0x20)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonBuffer.length + 8 + binary.length, 8);
const jsonHeader = Buffer.alloc(8);
jsonHeader.writeUInt32LE(jsonBuffer.length, 0);
jsonHeader.writeUInt32LE(0x4e4f534a, 4);
const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(binary.length, 0);
binHeader.writeUInt32LE(0x004e4942, 4);
await writeFile(outputPath, Buffer.concat([header, jsonHeader, jsonBuffer, binHeader, binary]));

console.log(`GLB: ${sumsX.length.toLocaleString()} vertices, ${trianglesKept.toLocaleString()} / ${trianglesSeen.toLocaleString()} triangles, ${materialNames.length} materials`);
