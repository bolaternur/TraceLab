import sharp from "sharp";
import { Matrix4, Quaternion, Vector3 } from "three";
import type { GlbInspection } from "./workspace-media-contract";

const MAX_TRIANGLES = 6000;
type Obj = Record<string, unknown>;
type Point = { x: number; y: number; z: number };
type Face = { points: Point[]; depth: number; color: string };
const object = (value: unknown) => value as Obj;
const array = (value: unknown) => Array.isArray(value) ? value : [];
const vector = (value: unknown, fallback: number[]) => {
  if (value === undefined) return fallback;
  if (!Array.isArray(value) || value.length !== fallback.length || value.some(number => typeof number !== "number" || !Number.isFinite(number) || Math.abs(number) > 1e8)) throw new Error("unsupported_thumbnail_transform");
  return value as number[];
};
function localMatrix(node: Obj) {
  if (node.matrix !== undefined) return new Matrix4().fromArray(vector(node.matrix, Array(16).fill(0)));
  return new Matrix4().compose(new Vector3().fromArray(vector(node.translation, [0, 0, 0])), new Quaternion().fromArray(vector(node.rotation, [0, 0, 0, 1])).normalize(), new Vector3().fromArray(vector(node.scale, [1, 1, 1])));
}

/** Bounded CPU preview. It executes no model code, loads no textures and creates no WebGL scenes. */
export async function createModelThumbnail(model: GlbInspection): Promise<{ bytes: Buffer; sampledTriangles: number } | null> {
  try {
    const { json, binary } = model, accessors = array(json.accessors), views = array(json.bufferViews), meshes = array(json.meshes), nodes = array(json.nodes);
    const scene = object(array(json.scenes)[Number(json.scene ?? 0)]), stride = Math.max(1, Math.ceil(model.triangles / MAX_TRIANGLES));
    const faces: Face[] = [], visited = new Set<number>(), light = new Vector3(0.4, 0.8, 0.6).normalize(); let triangleCursor = 0;
    function position(accessorIndex: unknown, index: number, world: Matrix4) {
      const accessor = object(accessors[Number(accessorIndex)]), view = object(views[Number(accessor.bufferView)]);
      const start = Number(view.byteOffset ?? 0) + Number(accessor.byteOffset ?? 0) + index * Number(view.byteStride ?? 12);
      const point = new Vector3(binary.readFloatLE(start), binary.readFloatLE(start + 4), binary.readFloatLE(start + 8)).applyMatrix4(world);
      if ([point.x, point.y, point.z].some(value => !Number.isFinite(value) || Math.abs(value) > 1e20)) throw new Error("unsupported_thumbnail_transform");
      return point;
    }
    function indexAt(accessorIndex: unknown, index: number) {
      if (accessorIndex === undefined) return index;
      const accessor = object(accessors[Number(accessorIndex)]), view = object(views[Number(accessor.bufferView)]), width = { 5121: 1, 5123: 2, 5125: 4 }[Number(accessor.componentType)]!;
      return binary.readUIntLE(Number(view.byteOffset ?? 0) + Number(accessor.byteOffset ?? 0) + index * Number(view.byteStride ?? width), width);
    }
    const project = (point: Vector3): Point => ({ x: (point.x - point.z) / Math.sqrt(2), y: (-point.x + 2 * point.y - point.z) / Math.sqrt(6), z: (point.x + point.y + point.z) / Math.sqrt(3) });
    function visit(index: number, parent: Matrix4, depth: number) {
      if (depth > 128) throw new Error("thumbnail_depth_exceeded");
      if (visited.has(index)) return; visited.add(index);
      const node = object(nodes[index]), world = parent.clone().multiply(localMatrix(node));
      if (world.elements.some(value => !Number.isFinite(value))) throw new Error("unsupported_thumbnail_transform");
      if (node.mesh !== undefined) for (const primitiveValue of array(object(meshes[Number(node.mesh)]).primitives)) {
        const primitive = object(primitiveValue), attributes = object(primitive.attributes);
        const positionAccessor = object(accessors[Number(attributes.POSITION)]), indices = primitive.indices === undefined ? Number(positionAccessor.count) : Number(object(accessors[Number(primitive.indices)]).count), count = indices / 3;
        const material = object(array(json.materials)[Number(primitive.material)] ?? {}), pbr = object(material.pbrMetallicRoughness ?? {});
        const base = Array.isArray(pbr.baseColorFactor) && pbr.baseColorFactor.length === 4 && pbr.baseColorFactor.every(value => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1) ? pbr.baseColorFactor.slice(0, 3).map(value => Number(value) * 255) : [125, 134, 146];
        const offset = (stride - triangleCursor % stride) % stride;
        for (let triangle = offset; triangle < count && faces.length < MAX_TRIANGLES; triangle += stride) {
          const points = [0, 1, 2].map(corner => position(attributes.POSITION, indexAt(primitive.indices, triangle * 3 + corner), world));
          const normal = points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
          const shade = 0.45 + Math.abs(normal.dot(light)) * 0.55, projected = points.map(project);
          faces.push({ points: projected, depth: projected.reduce((sum, point) => sum + point.z, 0) / 3, color: `rgb(${base.map(value => Math.round(value * shade)).join(",")})` });
        }
        triangleCursor += count;
      }
      for (const child of array(node.children)) visit(Number(child), world, depth + 1);
    }
    for (const root of array(scene.nodes)) visit(Number(root), new Matrix4(), 0);
    if (!faces.length) return null;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const face of faces) for (const point of face.points) { minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x); minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y); }
    const scale = Math.min(544 / Math.max(maxX - minX, 1e-12), 324 / Math.max(maxY - minY, 1e-12));
    const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
    faces.sort((a, b) => a.depth - b.depth);
    const polygons = faces.map(face => `<polygon points="${face.points.map(point => `${(320 + (point.x - centerX) * scale).toFixed(2)},${(210 - (point.y - centerY) * scale).toFixed(2)}`).join(" ")}" fill="${face.color}" stroke="${face.color}" stroke-width="0.4"/>`).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420"><rect width="640" height="420" fill="#ebe8e1"/>${polygons}</svg>`;
    return { bytes: await sharp(Buffer.from(svg)).webp({ quality: 78 }).toBuffer(), sampledTriangles: faces.length };
  } catch {
    // The derived preview must never destroy or replace the source GLB.
    return null;
  }
}
