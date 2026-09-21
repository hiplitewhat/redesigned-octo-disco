import { readFileSync, writeFileSync } from "fs";

function luaStr(s) {
  s = String(s ?? "");
  if (s.includes("\n") || s.includes('"') || s.includes("\\") || s.includes("\r")) {
    let eq = "==";
    while (s.includes("]" + eq + "]")) eq += "=";
    return "[" + eq + "[" + s + "]" + eq + "]";
  }
  return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

function ident(name, used) {
  let base = String(name || "inst").replace(/[^a-zA-Z0-9_]/g, "_").replace(/^(\d)/, "_$1");
  if (!base) base = "inst";
  if (base.length > 40) base = base.slice(0, 40);
  let n = base;
  let c = 0;
  while (used.has(n)) n = base + "_" + ++c;
  used.add(n);
  return n;
}

const text = readFileSync("./uploaded-summary.txt", "utf8");
const start = text.indexOf("=== instance tree ===");
if (start < 0) throw new Error("no instance tree in summary");
const treeLines = text.slice(start).split(/\r?\n/).slice(1).filter((l) => l.length);

const nodes = [];
for (const line of treeLines) {
  const m = line.match(/^(\s*)(\S+)\s+"(.*)"(?:\s+(.*))?$/);
  if (!m) continue;
  const depth = m[1].length / 2;
  const className = m[2];
  const name = m[3];
  const extra = m[4] || "";
  let cf = null;
  let size = null;
  const at = extra.match(/@(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)/);
  if (at) cf = [at[1], at[2], at[3]];
  const sz = extra.match(/size\s+(-?[\d.]+)x(-?[\d.]+)x(-?[\d.]+)/);
  if (sz) size = [sz[1], sz[2], sz[3]];
  nodes.push({ depth, className, name, cf, size });
}

const used = new Set(["workspace", "parent", "Build", "M"]);
const stack = [];
const lines = [];
lines.push("-- rbxm2SL-style dump of Uploaded.rbxl");
lines.push("-- " + nodes.length + " instances (Pose/Keyframe skipped)");
lines.push("-- Rebuilt from decoded tree: CFrame position + Size only (raw .rbxl no longer on disk)");
lines.push("-- Script Source is omitted (one ModuleScript child was ~98MB of source)");
lines.push("local function Build()");

for (const node of nodes) {
  while (stack.length > node.depth) stack.pop();
  const vn = ident(node.name || node.className, used);
  const parent = stack.length ? stack[stack.length - 1] : "workspace";
  const pad = "  ";
  lines.push(pad + "local " + vn + " = Instance.new(" + luaStr(node.className) + ")");
  lines.push(pad + vn + ".Name = " + luaStr(node.name));
  if (node.cf) {
    lines.push(pad + vn + ".CFrame = CFrame.new(" + node.cf.join(", ") + ")");
  }
  if (node.size) {
    lines.push(pad + vn + ".Size = Vector3.new(" + node.size.join(", ") + ")");
  }
  lines.push(pad + vn + ".Parent = " + parent);
  stack.push(vn);
}

lines.push("end");
lines.push("Build()");
const out = lines.join("\n") + "\n";
writeFileSync("./Uploaded.rbxl.lua", out);
console.log("instances", nodes.length);
console.log("lines", lines.length);
console.log("bytes", out.length);
