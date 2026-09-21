export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function componentToHex(c) {
  const clamped = Math.max(0, Math.min(255, Math.round(c)));
  const hex = clamped.toString(16);
  return hex.length === 1 ? "0" + hex : hex;
}

export function rgbToHex(r, g, b) {
  return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

export function color3ToHex(color) {
  if (!color) return "#ffffff";
  const r = (color.R ?? color.r ?? 1) * (color.R > 1 || color.G > 1 || color.B > 1 ? 1 : 255);
  const g = (color.G ?? color.g ?? 1) * (color.R > 1 || color.G > 1 || color.B > 1 ? 1 : 255);
  const b = (color.B ?? color.b ?? 1) * (color.R > 1 || color.G > 1 || color.B > 1 ? 1 : 255);
  if (color.R !== undefined && color.R <= 1 && color.G <= 1 && color.B <= 1) {
    return rgbToHex(color.R * 255, color.G * 255, color.B * 255);
  }
  return rgbToHex(r, g, b);
}

export function vec3(x, y, z) {
  return { X: x, Y: y, Z: z };
}

export function color3(r, g, b) {
  return { R: r, G: g, B: b };
}

/** Build a CFrame from position and optional XYZ Euler degrees (YXZ order). */
export function cframe(x, y, z, rotDeg = null) {
  let r00 = 1, r01 = 0, r02 = 0;
  let r10 = 0, r11 = 1, r12 = 0;
  let r20 = 0, r21 = 0, r22 = 1;
  let ox = 0, oy = 0, oz = 0;

  if (rotDeg) {
    ox = rotDeg[0] || 0;
    oy = rotDeg[1] || 0;
    oz = rotDeg[2] || 0;
    const ax = (ox * Math.PI) / 180;
    const ay = (oy * Math.PI) / 180;
    const az = (oz * Math.PI) / 180;
    const cx = Math.cos(ax), sx = Math.sin(ax);
    const cy = Math.cos(ay), sy = Math.sin(ay);
    const cz = Math.cos(az), sz = Math.sin(az);
    // YXZ
    r00 = cy * cz + sy * sx * sz;
    r01 = cz * sy * sx - cy * sz;
    r02 = cx * sy;
    r10 = cx * sz;
    r11 = cx * cz;
    r12 = -sx;
    r20 = cy * sx * sz - cz * sy;
    r21 = cy * cz * sx + sy * sz;
    r22 = cx * cy;
  }

  return {
    Position: { X: x, Y: y, Z: z },
    Orientation: { X: ox, Y: oy, Z: oz },
    Components: [x, y, z, r00, r01, r02, r10, r11, r12, r20, r21, r22],
  };
}

export function rotationMatrixFromCFrame(cf) {
  const c = cf.Components;
  return [
    c[3], c[6], c[9], 0,
    c[4], c[7], c[10], 0,
    c[5], c[8], c[11], 0,
    0, 0, 0, 1,
  ];
}

export function formatNumber(n, digits = 3) {
  if (typeof n !== "number" || Number.isNaN(n)) return String(n);
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(digits).replace(/\.?0+$/, "");
}

export function sniffRobloxFile(buffer) {
  const bytes = new Uint8Array(buffer);
  let offset = 0;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) offset = 3;
  const head = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(offset, offset + 16));
  if (head.startsWith("<roblox!")) return "binary";
  const trimmed = head.replace(/^\s+/, "");
  if (trimmed.startsWith("<roblox")) return "xml";
  return "unknown";
}
