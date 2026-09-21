/**
 * Parser for Roblox XML place/model files (.rbxlx / .rbxmx, and XML .rbxl/.rbxm).
 */

const SHAPE_TOKEN = { 0: "Ball", 1: "Block", 2: "Cylinder", 3: "Wedge", 4: "CornerWedge" };
const FACE_TOKEN = { 0: "Right", 1: "Top", 2: "Back", 3: "Left", 4: "Bottom", 5: "Front" };
const MATERIAL_TOKEN = {
  256: "Plastic",
  272: "SmoothPlastic",
  512: "Wood",
  528: "WoodPlanks",
  784: "Slate",
  800: "Concrete",
  816: "Granite",
  832: "Brick",
  848: "Pebble",
  864: "Cobblestone",
  880: "Rock",
  1040: "CorrodedMetal",
  1056: "DiamondPlate",
  1072: "Foil",
  1088: "Metal",
  1280: "Grass",
  1296: "Sand",
  1312: "Fabric",
  1328: "Ice",
  1344: "Marble",
  1536: "Ground",
  1552: "Snow",
  1568: "Mud",
  1584: "LeafyGrass",
  1600: "Salt",
  1616: "Limestone",
  1632: "Asphalt",
  2048: "Neon",
  2064: "Glass",
  2080: "ForceField",
};

function textContent(el) {
  return (el.textContent || "").trim();
}

function child(el, name) {
  for (const node of el.children) {
    if (node.tagName === name) return node;
  }
  return null;
}

function num(el, name, fallback = 0) {
  const n = child(el, name);
  if (!n) return fallback;
  const v = parseFloat(textContent(n));
  return Number.isNaN(v) ? fallback : v;
}

function parseVector3(el) {
  return { X: num(el, "X"), Y: num(el, "Y"), Z: num(el, "Z") };
}

function parseColor3(el, uint8 = false) {
  const r = num(el, "R"), g = num(el, "G"), b = num(el, "B");
  if (uint8 || r > 1 || g > 1 || b > 1) {
    return { R: r / 255, G: g / 255, B: b / 255 };
  }
  return { R: r, G: g, B: b };
}

function parseCFrame(el) {
  const x = num(el, "X"), y = num(el, "Y"), z = num(el, "Z");
  const r00 = num(el, "R00", 1), r01 = num(el, "R01"), r02 = num(el, "R02");
  const r10 = num(el, "R10"), r11 = num(el, "R11", 1), r12 = num(el, "R12");
  const r20 = num(el, "R20"), r21 = num(el, "R21"), r22 = num(el, "R22", 1);
  return {
    Position: { X: x, Y: y, Z: z },
    Components: [x, y, z, r00, r01, r02, r10, r11, r12, r20, r21, r22],
  };
}

function parseContent(el) {
  const url = child(el, "url") || child(el, "Url");
  if (url) return textContent(url);
  const binary = child(el, "binary");
  if (binary) return textContent(binary);
  return "";
}

function parseUDim2(el) {
  const xs = child(el, "XS") || el.querySelector("X");
  return {
    X: { Scale: num(el, "XS"), Offset: num(el, "XO") },
    Y: { Scale: num(el, "YS"), Offset: num(el, "YO") },
  };
}

function maybeEnum(name, value) {
  if (name === "Shape") return SHAPE_TOKEN[value] || value;
  if (name === "Face" || name === "Surface") return FACE_TOKEN[value] || value;
  if (name === "Material") return MATERIAL_TOKEN[value] || value;
  return value;
}

function parseProperty(el, inst) {
  const name = el.getAttribute("name");
  if (!name) return;
  const tag = el.tagName;

  switch (tag) {
    case "string":
    case "ProtectedString":
    case "BinaryString":
    case "SharedString":
    case "UniqueId":
      inst[name] = textContent(el);
      break;
    case "Content":
    case "ContentId":
      inst[name] = parseContent(el);
      break;
    case "bool":
      inst[name] = textContent(el).toLowerCase() === "true";
      break;
    case "float":
    case "double":
      inst[name] = parseFloat(textContent(el)) || 0;
      break;
    case "int":
    case "int64":
    case "token": {
      const n = parseInt(textContent(el), 10);
      inst[name] = tag === "token" ? maybeEnum(name, n) : n;
      break;
    }
    case "Vector3":
    case "Vector3int16":
      inst[name] = parseVector3(el);
      break;
    case "Vector2":
    case "Vector2int16":
      inst[name] = { X: num(el, "X"), Y: num(el, "Y") };
      break;
    case "Color3":
      inst[name] = parseColor3(el, false);
      if (name === "Color") inst.Color3 = inst[name];
      break;
    case "Color3uint8":
      inst[name] = parseColor3(el, true);
      if (name === "Color3uint8" || name === "Color") inst.Color3 = inst[name];
      break;
    case "CoordinateFrame":
    case "CFrame":
      inst[name] = parseCFrame(el);
      break;
    case "OptionalCoordinateFrame": {
      const cf = child(el, "CFrame") || child(el, "CoordinateFrame");
      inst[name] = cf ? parseCFrame(cf) : null;
      break;
    }
    case "UDim":
      inst[name] = { Scale: num(el, "S"), Offset: num(el, "O") };
      break;
    case "UDim2":
      inst[name] = parseUDim2(el);
      break;
    case "Rect2D":
      inst[name] = {
        Min: { X: num(el, "minX") || num(el, "X"), Y: num(el, "minY") || num(el, "Y") },
        Max: { X: num(el, "maxX"), Y: num(el, "maxY") },
      };
      break;
    case "Ref":
      inst[name] = textContent(el);
      break;
    default:
      inst[name] = textContent(el);
  }
}

function parseItem(el) {
  const inst = {
    ClassName: el.getAttribute("class") || "Instance",
    Name: el.getAttribute("class") || "Instance",
    referent: el.getAttribute("referent") || "",
    Children: [],
  };

  for (const childEl of el.children) {
    const tag = childEl.tagName;
    if (tag === "Properties") {
      for (const prop of childEl.children) parseProperty(prop, inst);
    } else if (tag === "Item") {
      inst.Children.push(parseItem(childEl));
    }
  }

  if (inst.Color && !inst.Color3) inst.Color3 = inst.Color;
  if (inst.CoordinateFrame && !inst.CFrame) inst.CFrame = inst.CoordinateFrame;
  if (typeof inst.Shape === "number") inst.Shape = SHAPE_TOKEN[inst.Shape] || inst.Shape;
  if (typeof inst.Face === "number") inst.Face = FACE_TOKEN[inst.Face] || inst.Face;

  return inst;
}

export function decodeXml(source) {
  let xml = source;
  if (source instanceof ArrayBuffer) xml = new TextDecoder().decode(source);
  else if (source instanceof Uint8Array) xml = new TextDecoder().decode(source);

  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) throw new Error("Invalid Roblox XML file");

  const root = doc.querySelector("roblox");
  if (!root) throw new Error("Not a Roblox XML file");

  const items = [];
  for (const childEl of root.children) {
    if (childEl.tagName === "Item") items.push(parseItem(childEl));
  }
  return items;
}
