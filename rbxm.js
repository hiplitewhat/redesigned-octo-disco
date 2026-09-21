/**
 * Roblox binary place/model parser (.rbxl / .rbxm).
 * Skips huge animation dumps (Pose/Keyframe/…) so large places can load in a browser.
 *
 * Usage:
 *   import { decode } from "./rbxm.js";
 *   const roots = decode(await file.arrayBuffer());
 */

const SKIP_CLASSES = new Set([
  "Pose",
  "Keyframe",
  "KeyframeSequence",
  "KeyframeMarker",
  "AnimationController",
  "Animator",
  "Bone",
  "Motor6D",
  "IntValue",
  "CFrameValue",
  "NumberValue",
  "BoolValue",
  "ObjectValue",
  "StringValue",
  "ParticleEmitter",
  "ChorusSoundEffect",
  "DistortionSoundEffect",
  "EqualizerSoundEffect",
  "PitchShiftSoundEffect",
  "ReverbSoundEffect",
  "TremoloSoundEffect",
]);

const SHAPE = { 0: "Ball", 1: "Block", 2: "Cylinder", 3: "Wedge", 4: "CornerWedge" };
const FACE = { 0: "Right", 1: "Top", 2: "Back", 3: "Left", 4: "Bottom", 5: "Front" };

const ROT_IDS = {
  0x02: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  0x03: [1, 0, 0, 0, 0, -1, 0, 1, 0],
  0x05: [1, 0, 0, 0, -1, 0, 0, 0, -1],
  0x06: [1, 0, 0, 0, 0, 1, 0, -1, 0],
  0x07: [0, 1, 0, 1, 0, 0, 0, 0, -1],
  0x09: [0, 0, 1, 1, 0, 0, 0, 1, 0],
  0x0a: [0, -1, 0, 1, 0, 0, 0, 0, 1],
  0x0c: [0, 0, -1, 1, 0, 0, 0, -1, 0],
  0x0d: [0, 1, 0, 0, 0, 1, 1, 0, 0],
  0x0e: [0, 0, -1, 0, 1, 0, 1, 0, 0],
  0x10: [0, -1, 0, 0, 0, -1, 1, 0, 0],
  0x11: [0, 0, 1, 0, -1, 0, 1, 0, 0],
  0x14: [-1, 0, 0, 0, 1, 0, 0, 0, -1],
  0x15: [-1, 0, 0, 0, 0, 1, 0, 1, 0],
  0x17: [-1, 0, 0, 0, -1, 0, 0, 0, 1],
  0x18: [-1, 0, 0, 0, 0, -1, 0, -1, 0],
  0x19: [0, 1, 0, -1, 0, 0, 0, 0, 1],
  0x1b: [0, 0, -1, -1, 0, 0, 0, 1, 0],
  0x1c: [0, -1, 0, -1, 0, 0, 0, 0, -1],
  0x1e: [0, 0, 1, -1, 0, 0, 0, -1, 0],
  0x1f: [0, 1, 0, 0, 0, -1, -1, 0, 0],
  0x20: [0, 0, 1, 0, 1, 0, -1, 0, 0],
  0x22: [0, -1, 0, 0, 0, 1, -1, 0, 0],
  0x23: [0, 0, -1, 0, -1, 0, -1, 0, 0],
};

function lz4Decompress(src, destSize) {
  const dest = new Uint8Array(destSize);
  let s = 0;
  let d = 0;
  const sl = src.length;
  while (s < sl && d < destSize) {
    const token = src[s++];
    let lit = token >>> 4;
    if (lit === 15) {
      let n;
      do {
        n = src[s++];
        lit += n;
      } while (n === 255);
    }
    for (let i = 0; i < lit; i++) dest[d++] = src[s++];
    if (s >= sl || d >= destSize) break;
    const offset = src[s] | (src[s + 1] << 8);
    s += 2;
    if (offset === 0) break;
    let match = (token & 0x0f) + 4;
    if ((token & 0x0f) === 15) {
      let n;
      do {
        n = src[s++];
        match += n;
      } while (n === 255);
    }
    let m = d - offset;
    for (let i = 0; i < match && d < destSize; i++) dest[d++] = dest[m++];
  }
  return dest;
}

const _f32 = new DataView(new ArrayBuffer(4));
const _f64 = new DataView(new ArrayBuffer(8));

class Cursor {
  constructor(bytes) {
    this.u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    this.offset = 0;
  }
  get remaining() {
    return this.u8.length - this.offset;
  }
  _need(n) {
    if (this.offset + n > this.u8.length) {
      throw new RangeError(`Read past end of chunk at ${this.offset}+${n}/${this.u8.length}`);
    }
  }
  uint8() {
    this._need(1);
    return this.u8[this.offset++];
  }
  int16() {
    this._need(2);
    const v = this.u8[this.offset] | (this.u8[this.offset + 1] << 8);
    this.offset += 2;
    return (v << 16) >> 16;
  }
  uint16() {
    this._need(2);
    const v = this.u8[this.offset] | (this.u8[this.offset + 1] << 8);
    this.offset += 2;
    return v;
  }
  int32() {
    return this.uint32() | 0;
  }
  uint32() {
    this._need(4);
    const o = this.offset;
    const v =
      this.u8[o] +
      this.u8[o + 1] * 256 +
      this.u8[o + 2] * 65536 +
      this.u8[o + 3] * 16777216;
    this.offset += 4;
    return v >>> 0;
  }
  float32() {
    this._need(4);
    _f32.setUint8(0, this.u8[this.offset]);
    _f32.setUint8(1, this.u8[this.offset + 1]);
    _f32.setUint8(2, this.u8[this.offset + 2]);
    _f32.setUint8(3, this.u8[this.offset + 3]);
    this.offset += 4;
    return _f32.getFloat32(0, true);
  }
  float64() {
    this._need(8);
    for (let i = 0; i < 8; i++) _f64.setUint8(i, this.u8[this.offset + i]);
    this.offset += 8;
    return _f64.getFloat64(0, true);
  }
  bytes(n) {
    this._need(n);
    const slice = this.u8.slice(this.offset, this.offset + n);
    this.offset += n;
    return slice;
  }
  string() {
    const n = this.uint32();
    this._need(n);
    const slice = this.u8.subarray(this.offset, this.offset + n);
    this.offset += n;
    return new TextDecoder("utf-8", { fatal: false }).decode(slice);
  }
  interleavedUint32(n) {
    this._need(n * 4);
    const out = new Array(n);
    const start = this.offset;
    for (let i = 0; i < n; i++) {
      out[i] =
        (this.u8[start + i] * 0x1000000 +
          (this.u8[start + i + n] << 16) +
          (this.u8[start + i + n * 2] << 8) +
          this.u8[start + i + n * 3]) >>>
        0;
    }
    this.offset += n * 4;
    return out;
  }
  interleavedInt32(n) {
    return this.interleavedUint32(n).map((v) => (v >>> 1) ^ -(v & 1));
  }
  interleavedFloat(n) {
    return this.interleavedUint32(n).map((longNum) => {
      const exponent = longNum >>> 24;
      if (exponent === 0) return 0;
      const floatNum = 2 ** (exponent - 127) * (1 + ((longNum >>> 1) & 0x7fffff) / 0x7fffff);
      return longNum & 1 ? -floatNum : floatNum;
    });
  }
}

function readChunk(file) {
  const sig = String.fromCharCode(file.uint8(), file.uint8(), file.uint8(), file.uint8());
  const compressedLength = file.uint32();
  const uncompressedLength = file.uint32();
  file.offset += 4;
  const dataLength = compressedLength === 0 ? uncompressedLength : compressedLength;
  const payloadBytes = file.bytes(dataLength);
  const raw =
    compressedLength === 0 ? payloadBytes : lz4Decompress(payloadBytes, uncompressedLength);
  return { signature: sig, payload: new Cursor(raw) };
}

function readCFrames(cur, count) {
  const matrices = new Array(count);
  for (let i = 0; i < count; i++) {
    const rotId = cur.uint8();
    if (rotId !== 0 && ROT_IDS[rotId]) {
      matrices[i] = ROT_IDS[rotId];
    } else if (rotId === 0) {
      const m = new Array(9);
      for (let j = 0; j < 9; j++) m[j] = cur.float32();
      matrices[i] = m;
    } else {
      matrices[i] = ROT_IDS[0x02];
    }
  }
  const x = cur.interleavedFloat(count);
  const y = cur.interleavedFloat(count);
  const z = cur.interleavedFloat(count);
  const out = new Array(count);
  for (let i = 0; i < count; i++) {
    const m = matrices[i];
    out[i] = {
      Position: { X: x[i], Y: y[i], Z: z[i] },
      Components: [x[i], y[i], z[i], m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8]],
    };
  }
  return out;
}

function readProperty(cur, count, className, propName) {
  if (cur.remaining <= 0) return null;
  const typeId = cur.uint8();
  const values = new Array(count);
  try {
    switch (typeId) {
      case 0x01: {
        for (let i = 0; i < count; i++) values[i] = cur.string();
        break;
      }
      case 0x02: {
        for (let i = 0; i < count; i++) values[i] = cur.uint8() === 1;
        break;
      }
      case 0x03: {
        const ints = cur.interleavedInt32(count);
        for (let i = 0; i < count; i++) values[i] = ints[i];
        break;
      }
      case 0x04: {
        const floats = cur.interleavedFloat(count);
        for (let i = 0; i < count; i++) values[i] = floats[i];
        break;
      }
      case 0x05: {
        for (let i = 0; i < count; i++) values[i] = cur.float64();
        break;
      }
      case 0x0c: {
        const r = cur.interleavedFloat(count);
        const g = cur.interleavedFloat(count);
        const b = cur.interleavedFloat(count);
        for (let i = 0; i < count; i++) values[i] = { R: r[i], G: g[i], B: b[i] };
        break;
      }
      case 0x0e: {
        const x = cur.interleavedFloat(count);
        const y = cur.interleavedFloat(count);
        const z = cur.interleavedFloat(count);
        for (let i = 0; i < count; i++) values[i] = { X: x[i], Y: y[i], Z: z[i] };
        break;
      }
      case 0x10: {
        return readCFrames(cur, count);
      }
      case 0x12: {
        const toks = cur.interleavedUint32(count);
        for (let i = 0; i < count; i++) {
          const t = toks[i];
          if (propName === "Shape") values[i] = SHAPE[t] ?? t;
          else if (propName === "Face") values[i] = FACE[t] ?? t;
          else values[i] = t;
        }
        break;
      }
      case 0x1a: {
        for (let i = 0; i < count; i++) {
          const r = cur.uint8();
          const g = cur.uint8();
          const b = cur.uint8();
          values[i] = { R: r / 255, G: g / 255, B: b / 255 };
        }
        break;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
  return values;
}

export function decode(buffer) {
  const start = performance.now();
  const file = new Cursor(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));
  const magic = new TextDecoder().decode(file.bytes(8));
  if (magic !== "<roblox!") throw new Error("Not a Roblox binary file");
  file.offset += 6;
  const version = file.uint16();
  const classCount = file.uint32();
  const instanceCount = file.uint32();
  file.offset += 8;
  console.log("Valid file signature.");
  console.log("Version:", version);
  console.log("Header:", { classCount, instanceCount });

  const instances = new Array(instanceCount);
  const classes = [];
  const roots = [];

  let chunk = { signature: "" };
  while (chunk.signature !== "END\0" && file.remaining > 0) {
    try {
      chunk = readChunk(file);
    } catch (err) {
      console.log("Chunk read failed:", String(err && err.message ? err.message : err));
      break;
    }
    const p = chunk.payload;
    if (chunk.signature === "INST") {
      try {
        const classId = p.int32();
        const className = p.string();
        const objectFormat = p.uint8();
        const count = p.uint32();
        const refs = p.interleavedInt32(count);
        if (objectFormat === 1) p.offset += count;
        const skip = SKIP_CLASSES.has(className);
        const ids = new Array(count);
        let referent = 0;
        for (let i = 0; i < count; i++) {
          referent += refs[i];
          ids[i] = referent;
          if (!skip) {
            instances[referent] = { ClassName: className, Name: className, Children: [] };
          }
        }
        classes[classId] = { className, ids, skip, count };
      } catch (err) {
        console.log("Skipping INST chunk:", String(err && err.message ? err.message : err));
      }
    } else if (chunk.signature === "PROP") {
      const classId = p.int32();
      const cls = classes[classId];
      if (!cls || cls.skip) continue;
      const propName = p.string();
      const values = readProperty(p, cls.count, cls.className, propName);
      if (!values) continue;
      let name = propName.charAt(0).toUpperCase() + propName.slice(1);
      if (name === "Color3uint8") name = "Color3";
      for (let i = 0; i < cls.count; i++) {
        const inst = instances[cls.ids[i]];
        if (!inst) continue;
        inst[name] = values[i];
        if (name === "Color") inst.Color3 = values[i];
        if (name === "CoordinateFrame") inst.CFrame = values[i];
      }
    } else if (chunk.signature === "PRNT") {
      p.uint8();
      const assoc = p.uint32();
      const children = p.interleavedInt32(assoc);
      const parents = p.interleavedInt32(assoc);
      let childId = 0;
      let parentId = 0;
      for (let i = 0; i < assoc; i++) {
        childId += children[i];
        parentId += parents[i];
        const child = instances[childId];
        if (!child) continue;
        if (parentId < 0) {
          roots.push(child);
        } else {
          const parent = instances[parentId];
          if (parent) parent.Children.push(child);
          else roots.push(child);
        }
      }
    }
  }

  console.log("Finished decoding file.\nTime elapsed:", performance.now() - start, "ms");
  return roots.filter(Boolean);
}
