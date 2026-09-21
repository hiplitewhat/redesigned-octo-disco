/**
 * Roblox mesh format parser (versions 1.00, 1.01, 2.00, 3.00, 4.00).
 * Format is publicly documented; this is an original implementation.
 */

function parse1xMesh(text, is10) {
  const vectors = text.replace(/]/g, "").split("[");
  const header = vectors.shift();
  const positions = [];
  const normal = [];
  const uv = [];
  const offset = is10 ? 0.5 : 1;

  function toVector(vstring, scale) {
    return vstring.split(",").map((n) => parseFloat(n) * scale);
  }

  for (let i = 0; i < vectors.length; i += 3) {
    if (!vectors[i + 2]) break;
    positions.push(...toVector(vectors[i], offset));
    normal.push(...toVector(vectors[i + 1], 1));
    const uvv = toVector(vectors[i + 2], 1);
    uv.push(uvv[0], uvv[1]);
  }

  console.log(`Parsed version 1 mesh. Header: ${header.trim()}  Vectors: ${vectors.length}`);
  return { positions, normal, uv };
}

function parseBinaryMesh(dv, version) {
  const headerStart = 13;
  const header = {
    sizeof_MeshHeader: dv.getUint16(headerStart, true),
    sizeof_Vertex: dv.getUint8(headerStart + 2, true),
    sizeof_Face: dv.getUint8(headerStart + 3, true),
    numVerts: dv.getUint32(headerStart + 4, true),
    numFaces: dv.getUint32(headerStart + 8, true),
    sizeof_LOD: 0,
    numLODs: 0,
  };

  if (header.sizeof_MeshHeader >= 16) {
    header.sizeof_LOD = dv.getUint16(headerStart + 4, true);
    header.numLODs = dv.getUint16(headerStart + 6, true);
    header.numVerts = dv.getUint32(headerStart + 8, true);
    header.numFaces = dv.getUint32(headerStart + 12, true);
  }

  console.log(`Parsing mesh v${version}`, header);

  let i = headerStart + header.sizeof_MeshHeader;
  const vertices = [];
  const vertEnd = i + header.numVerts * header.sizeof_Vertex;

  while (i < vertEnd) {
    const vertex = {
      px: dv.getFloat32(i, true),
      py: dv.getFloat32(i + 4, true),
      pz: dv.getFloat32(i + 8, true),
      nx: dv.getFloat32(i + 12, true),
      ny: dv.getFloat32(i + 16, true),
      nz: dv.getFloat32(i + 20, true),
      u: dv.getFloat32(i + 24, true),
      v: dv.getFloat32(i + 28, true),
      w: dv.getFloat32(i + 32, true),
    };
    vertices.push(vertex);
    i += header.sizeof_Vertex;
  }

  const faces = [];
  const facesEnd = i + header.numFaces * (header.sizeof_Face || 12);
  while (i < facesEnd) {
    faces.push({
      a: dv.getUint32(i, true),
      b: dv.getUint32(i + 4, true),
      c: dv.getUint32(i + 8, true),
    });
    i += header.sizeof_Face || 12;
  }

  const lods = [];
  if (header.numLODs > 0 && header.sizeof_LOD > 0) {
    for (let n = 0; n < header.numLODs; n++) {
      lods.push(dv.getUint32(i, true));
      i += header.sizeof_LOD;
    }
  }

  const positions = [];
  const normal = [];
  const uv = [];
  const faceLimit = lods.length > 1 ? lods[1] : faces.length;

  for (let f = 0; f < faces.length && f < faceLimit; f++) {
    const face = faces[f];
    for (const key of ["a", "b", "c"]) {
      const vertex = vertices[face[key]];
      if (!vertex) continue;
      positions.push(vertex.px, vertex.py, vertex.pz);
      normal.push(vertex.nx, vertex.ny, vertex.nz);
      uv.push(vertex.u, 1 - vertex.v);
    }
  }

  return { positions, normal, uv };
}

const meshCache = {};

export function parseMesh(data, meshId) {
  if (meshId && meshCache[meshId]) return meshCache[meshId];
  const stringData = new TextDecoder().decode(data.slice(0, 32));
  let result;

  if (stringData.startsWith("version 1.00") || stringData.startsWith("version 1.01")) {
    result = parse1xMesh(new TextDecoder().decode(data), stringData.startsWith("version 1.00"));
  } else if (
    stringData.startsWith("version 2.00") ||
    stringData.startsWith("version 3.00") ||
    stringData.startsWith("version 4.00") ||
    stringData.startsWith("version 5.00")
  ) {
    const version = stringData.substring(8, 12);
    result = parseBinaryMesh(new DataView(data), version);
  } else {
    console.log("Unsupported mesh " + stringData.split("\n")[0]);
    throw new Error("Unsupported mesh version");
  }

  if (meshId) meshCache[meshId] = result;
  return result;
}
