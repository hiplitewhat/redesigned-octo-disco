import Stats from "three/addons/libs/stats.module.js";
import { StudioLiteRenderer, partClasses } from "./rendering/StudioLiteRenderer.js?v=5";
import { sleep, rgbToHex, formatNumber } from "./etc/Helpers.js?v=5";
import { iconFor, THREE_CLASS_ICONS } from "./etc/Icons.js?v=5";
import ExplorerTree from "./ui/ExplorerTree.js?v=5";
import { createDemoPlace } from "./demo/DemoPlace.js?v=5";

const titleBar = document.body.querySelector(".title-bar");
const sstat = document.body.querySelector("#menuitem-stats");
const saxes = document.body.querySelector("#menuitem-axes");
const sbx2 = document.body.querySelector("#menuitem-hoverbox");
const sbox = document.body.querySelector("#menuitem-selectionbox");
const szoom = document.body.querySelector("#menuitem-zoomto");
const ssky = document.body.querySelector("#menuitem-skybox");
const log = document.body.querySelector(".log");
const msg = document.body.querySelector(".message");
const editor = document.body.querySelector(".editor");
const bar = document.body.querySelector(".status-bar-field > *[role=progressbar]");
const status = document.body.querySelector(".status-bar-field.status");
const menurender = document.body.querySelector("#menuitem-renderimage");
const hud = document.body.querySelector(".hud-help");
menurender.setAttribute("aria-disabled", "true");
let sal = document.body.querySelector(".onboarding");
szoom.setAttribute("aria-disabled", "true");

const jsTreeData = [];

function threeNodeToTreeData(nodes) {
  const data = [];
  for (const child of nodes) {
    const typeName = child.type || child.constructor?.name || "Object3D";
    data.push({
      node: child,
      text: child.name && child.name.length > 0 ? child.name : typeName,
      className: THREE_CLASS_ICONS[typeName] || typeName,
      icon: iconFor(THREE_CLASS_ICONS[typeName] || typeName),
      children: threeNodeToTreeData(child.children || []),
      id: "three-" + child.id,
    });
  }
  return data;
}

let treeRefresh2 = () => {};

function isNarrow() {
  return window.innerWidth < 960;
}

function viewportSize() {
  return {
    get width() {
      return Math.max(200, window.innerWidth - (isNarrow() ? 0 : 400));
    },
    get height() {
      const dock = isNarrow() ? 48 : 0;
      const cons = isNarrow() ? 0 : 178;
      return Math.max(160, window.innerHeight - cons - 58 - 26 - dock);
    },
  };
}

const size = viewportSize();

const renderer = new StudioLiteRenderer({
  get width() {
    return size.width;
  },
  get height() {
    return size.height;
  },
  sharedFunctions: {
    print,
    treeRefresh2: () => treeRefresh2(),
  },
  sharedObjects: { jsTreeData },
});
document.body.appendChild(renderer.domElement);

const stats = Stats();
document.body.appendChild(stats.dom);
stats.dom.id = "stats";
stats.dom.style.display = "none";
sstat.addEventListener("input", () => {
  stats.dom.style.display = sstat.checked ? "block" : "none";
});

let rendering = true;
renderer.setAnimationLoop(() => {
  if (rendering) renderer.render();
  stats.update();
});

function print(s) {
  const date = new Date();
  const el = document.createElement("span");
  const br = document.createElement("br");
  if (typeof s === "object") s = JSON.stringify(s);
  el.textContent = `${date.toLocaleTimeString("en-US")}.${date.getMilliseconds().toString().padStart(3, "0")} - ${s}`;
  log.appendChild(el);
  log.appendChild(br);
  log.scrollTo(0, log.scrollHeight);
}

const nativeLog = window.console.log.bind(window.console);
window.console.log = (...args) => {
  nativeLog(...args);
  let s = "";
  for (let t of args) {
    if (typeof t === "object") {
      try {
        t = JSON.stringify(t);
      } catch {
        t = String(t);
      }
    }
    s += t + " ";
  }
  s = s.substring(0, s.length - 1).split("\n");
  for (const t of s) print(t);
};

function setTitle(t) {
  t = `${t} - Studio Lite`;
  document.title = t;
  titleBar.querySelector(".title-bar-text").textContent = t;
}

function barError() {
  bar.classList.add("error");
}

const hiddenProperties = [
  "Children",
  "Source",
  "CollisionGroupData",
  "PhysicsGrid",
  "SmoothGrid",
  "MaterialColors",
  "referent",
];

const dropdownProperties = [
  "BackSurface", "BottomSurface", "FrontSurface", "LeftSurface", "RightSurface", "TopSurface",
  "Material", "Shape", "Face", "CameraType", "RunContext", "Technology", "AmbientReverb",
];

const colorProperties = [
  "Color3", "Color", "TintColor", "Ambient", "ColorShift_Top", "ColorShift_Bottom",
  "FogColor", "OutdoorAmbient", "BackgroundColor3", "BorderColor3", "ImageColor3",
  "TextColor3", "PlaceholderColor3", "TextStrokeColor3",
];

function formatValue(key, value) {
  if (value == null) return "null";
  if (typeof value === "object") {
    if (value.X != null && value.Y != null && value.Z != null) {
      return `${formatNumber(value.X)}, ${formatNumber(value.Y)}, ${formatNumber(value.Z)}`;
    }
    if (value.Position) {
      const p = value.Position;
      return `${formatNumber(p.X)}, ${formatNumber(p.Y)}, ${formatNumber(p.Z)}`;
    }
    if (value.R != null && value.G != null && value.B != null) {
      return `${formatNumber(value.R)}, ${formatNumber(value.G)}, ${formatNumber(value.B)}`;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

const propTable = document.body.querySelector(".properties > table > tbody");
const propSpinner = document.body.querySelector(".properties > .loader");
const propertiesTitle = document.body.querySelector("#propertiesTitle");

function showProperties(instance, titleKind) {
  if (!instance) return;
  const name = instance.Name || instance.name || instance.type || "";
  const klass = instance.ClassName || instance.type || titleKind || "Instance";
  propertiesTitle.textContent = `Properties - ${klass} "${name}"`;
  propTable.innerHTML = "";
  const keys = Object.keys(instance).sort((a, b) => a.localeCompare(b));
  for (const key of keys) {
    if (hiddenProperties.indexOf(key) !== -1) continue;
    const value = instance[key];
    const row = document.createElement("tr");
    const one = document.createElement("td");
    const two = document.createElement("td");
    one.textContent = key;

    if (colorProperties.indexOf(key) !== -1 && value && typeof value === "object") {
      const swatch = document.createElement("span");
      swatch.className = "prop-swatch";
      const r = (value.R ?? 1) <= 1 ? value.R * 255 : value.R;
      const g = (value.G ?? 1) <= 1 ? value.G * 255 : value.G;
      const b = (value.B ?? 1) <= 1 ? value.B * 255 : value.B;
      swatch.style.background = rgbToHex(r, g, b);
      two.appendChild(swatch);
      const span = document.createElement("span");
      span.className = "prop-mono";
      span.textContent = rgbToHex(r, g, b);
      two.appendChild(span);
    } else if (value === true || value === false) {
      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.checked = value;
      chk.disabled = true;
      two.appendChild(chk);
    } else if (typeof value === "number") {
      const nr = document.createElement("input");
      nr.type = "number";
      nr.value = value;
      nr.disabled = true;
      two.appendChild(nr);
    } else if (dropdownProperties.indexOf(key) !== -1) {
      const sel = document.createElement("select");
      const opt = document.createElement("option");
      opt.textContent = String(value);
      opt.selected = true;
      sel.disabled = true;
      sel.appendChild(opt);
      two.appendChild(sel);
    } else {
      two.textContent = formatValue(key, value);
      two.className = "prop-mono";
    }
    row.appendChild(one);
    row.appendChild(two);
    propTable.appendChild(row);
  }
  propSpinner.style.display = "none";
  propTable.style.display = "table-row-group";
}

function showScript(instance) {
  if (["Script", "LocalScript", "ModuleScript"].indexOf(instance.ClassName) !== -1) {
    setTitle(instance.Name);
    editor.style.display = "block";
    editor.innerHTML = "";
    const pre = document.createElement("pre");
    pre.textContent = instance.Source || "-- (empty script)";
    editor.appendChild(pre);
    rendering = false;
    if (hud) hud.style.display = "none";
  } else {
    rendering = true;
    setTitle(placeName);
    editor.innerHTML = "";
    editor.style.display = "none";
    if (hud) hud.style.display = "block";
  }
}

const dataTree = new ExplorerTree(document.body.querySelector(".tree"), {
  onSelect(node) {
    const instance = node.instance;
    if (!instance) return;
    renderer.updateSelectionBox(renderer.getThreeId(node.id));
    if (instance.CFrame && instance.CFrame.Position) {
      renderer.setAxesPosition(instance.CFrame.Position.X, instance.CFrame.Position.Y, instance.CFrame.Position.Z);
    }
    if (partClasses.indexOf(instance.ClassName) !== -1 && (instance.CFrame || instance.CoordinateFrame)) {
      szoom.removeAttribute("aria-disabled");
    } else {
      szoom.setAttribute("aria-disabled", "true");
    }
    showScript(instance);
    showProperties(instance, instance.ClassName);
  },
});

const sceneTree = new ExplorerTree(document.body.querySelector(".tree2"), {
  onSelect(node) {
    const obj = node.node;
    if (!obj) return;
    showProperties(obj, obj.type);
    rendering = true;
    editor.style.display = "none";
  },
});

let file = "";
let placeName = "Start Page";
let placeLoaded = false;

const zoomTo = () => {
  const node = dataTree.getSelected();
  if (!node || !node.instance) return;
  const instance = node.instance;
  if (partClasses.indexOf(instance.ClassName) !== -1) {
    try {
      renderer.lookAtPart(instance);
    } catch {
      /* ignore */
    }
  }
};

szoom.addEventListener("click", zoomTo);
document.addEventListener("keydown", (e) => {
  if (e.code === "KeyF" && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
    zoomTo();
  }
});

function wireViewToggles() {
  renderer.toggleAxes(saxes.checked);
  renderer.showSkybox(ssky.checked);
  renderer.useSelectionBox = sbox.checked;
  renderer.useSelectionBox2 = sbx2.checked;
}

saxes.addEventListener("input", () => {
  renderer.toggleAxes(saxes.checked);
  treeRefresh2();
});
ssky.addEventListener("input", () => renderer.showSkybox(ssky.checked));
sbox.addEventListener("input", () => {
  renderer.useSelectionBox = sbox.checked;
  renderer.removeSelectionBoxesIfNeeded();
});
sbx2.addEventListener("input", () => {
  renderer.useSelectionBox2 = sbx2.checked;
  renderer.removeSelectionBoxesIfNeeded();
});

renderer.domElement.addEventListener("pointerup", (e) => {
  if (!renderer.controls.wasTap()) return;
  const hit = renderer.pickInstanceAt(e.clientX, e.clientY);
  if (hit && hit.treeId != null) dataTree.select(hit.treeId, true);
});

const fly = renderer.controls;
const stick = document.body.querySelector("#move-stick");
const knob = stick && stick.querySelector(".stick-knob");
if (stick && knob) {
  const maxR = 40;
  const setStick = (clientX, clientY) => {
    const r = stick.querySelector(".stick-base").getBoundingClientRect();
    let x = clientX - (r.left + r.width / 2);
    let y = clientY - (r.top + r.height / 2);
    const len = Math.hypot(x, y) || 1;
    const s = Math.min(1, len / maxR);
    x = (x / len) * s;
    y = (y / len) * s;
    fly.moveRight = x > 0.22;
    fly.moveLeft = x < -0.22;
    fly.moveForward = y < -0.22;
    fly.moveBackward = y > 0.22;
    knob.style.transform = `translate(${x * maxR}px, ${y * maxR}px)`;
  };
  const resetStick = () => {
    fly.moveRight = fly.moveLeft = fly.moveForward = fly.moveBackward = false;
    knob.style.transform = "";
  };
  stick.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    stick.setPointerCapture(e.pointerId);
    setStick(e.clientX, e.clientY);
  });
  stick.addEventListener("pointermove", (e) => {
    if (!stick.hasPointerCapture(e.pointerId)) return;
    setStick(e.clientX, e.clientY);
  });
  stick.addEventListener("pointerup", resetStick);
  stick.addEventListener("pointercancel", resetStick);
}

for (const btn of document.body.querySelectorAll(".touch-btns [data-act]")) {
  const apply = (down) => {
    const act = btn.getAttribute("data-act");
    if (act === "up") fly.moveUp = down;
    else if (act === "down") fly.moveDown = down;
    else if (act === "sprint") fly.sprint = down;
  };
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    apply(true);
  });
  btn.addEventListener("pointerup", () => apply(false));
  btn.addEventListener("pointercancel", () => apply(false));
  btn.addEventListener("lostpointercapture", () => apply(false));
}

function setPanel(name) {
  const classes = ["panel-explorer", "panel-properties", "panel-console"];
  const current = classes.find((c) => document.body.classList.contains(c));
  for (const c of classes) document.body.classList.remove(c);
  for (const b of document.body.querySelectorAll(".mobile-dock [data-panel]")) {
    b.setAttribute("aria-pressed", "false");
  }
  if (name && current !== "panel-" + name) {
    document.body.classList.add("panel-" + name);
    const btn = document.body.querySelector(`.mobile-dock [data-panel="${name}"]`);
    if (btn) btn.setAttribute("aria-pressed", "true");
  }
}

for (const btn of document.body.querySelectorAll(".mobile-dock [data-panel]")) {
  btn.addEventListener("click", () => setPanel(btn.getAttribute("data-panel")));
}

async function finishLoad() {
  wireViewToggles();
  for (const item of jsTreeData) {
    if (!item.icon) item.icon = iconFor(item.className);
    const stack = [item];
    while (stack.length) {
      const n = stack.pop();
      n.icon = iconFor(n.className);
      if (n.children) for (const c of n.children) stack.push(c);
    }
  }
  dataTree.setData(jsTreeData);
  rendering = true;
  msg.style.display = "none";
  if (sal) sal.style.display = "none";

  const waitForQueuedOps = setInterval(() => {
    if (renderer.queueSize === 0) {
      clearInterval(waitForQueuedOps);
      bar.className = "animate";
      status.textContent = "Ready";
      if (renderer.mAssetManager.hasRbxGameAsset) {
        print("This Place contains rbxgameasset:// paths. Studio Lite cannot resolve them, as they are relative to the published game.");
      }
      if (renderer.mAssetManager.computeMissingAssetsList()) {
        print("Some assets failed to load! See File > Missing assets for more info.");
      }
      treeRefresh2();
      menurender.removeAttribute("aria-disabled");
      placeLoaded = true;
    }
  }, 250);
}

async function startFromBuffer(buffer, name) {
  bar.className = "marquee";
  status.textContent = `Loading ${name}`;
  rendering = false;
  titleBar.classList.add("active");
  msg.querySelector("span").textContent = "Loading Place. Please wait...";
  msg.style.display = "flex";
  if (sal) sal.style.display = "none";
  placeName = name;
  setTitle(placeName);
  try {
    await renderer.loadPlace(buffer);
  } catch (err) {
    print("The file could not be read. Please reload.");
    print(String(err && err.message ? err.message : err));
    barError();
    msg.querySelector("span").textContent = "The file could not be read.";
    throw err;
  }
  await finishLoad();
}

async function startFromData(data, name) {
  bar.className = "marquee";
  status.textContent = `Loading ${name}`;
  rendering = false;
  msg.querySelector("span").textContent = "Loading Place. Please wait...";
  msg.style.display = "flex";
  placeName = name;
  setTitle(placeName);
  jsTreeData.length = 0;
  await renderer.loadDataModel(data, jsTreeData);
  await finishLoad();
}

async function start() {
  bar.className = "marquee paused";
  status.textContent = "Busy";
  rendering = false;
  titleBar.classList.add("active");
  msg.querySelector("span").textContent = "Loading Place. Please wait...";
  msg.style.display = "flex";
  if (sal) sal.style.display = "none";
  try {
    if (typeof file === "string") {
      print(`DataModel Loading ${file}`);
      placeName = file.split("/").pop();
      status.textContent = `Fetching ${placeName}`;
      msg.querySelector("span").textContent = `Fetching ${placeName}…`;
      const fileData = await fetch(file);
      if (fileData.status !== 200) throw new Error("Failed to fetch");
      bar.classList.remove("paused");
      status.textContent = `Loading ${placeName}`;
      msg.querySelector("span").textContent = `Decoding ${placeName} (this can take a while)…`;
      await sleep(50);
      await startFromBuffer(await fileData.arrayBuffer(), placeName);
    } else {
      print(`DataModel Loading ${file.name}`);
      placeName = file.name;
      bar.classList.remove("paused");
      await startFromBuffer(await file.arrayBuffer(), placeName);
    }
  } catch (err) {
    print("The file could not be read. Please reload.");
    barError();
    msg.querySelector("span").textContent = "The file could not be read. Please reload.";
  }
}

document.body.querySelector("#menuitem-reload").addEventListener("click", () => window.location.reload());
document.body.querySelector("#menuitem-rbxm2sl").addEventListener("click", () => {
  window.open("./rbxm2sl.html", "_blank");
});

function openNotepad(fileName, text) {
  const dlg = document.body.querySelector("#notepad");
  const title = dlg.querySelector("#dialog-title");
  const textarea = dlg.querySelector("textarea");
  title.textContent = `${fileName} - Notepad`;
  textarea.value = text;
  const close = () => {
    dlg.close();
    titleBar.classList.add("active");
  };
  dlg.querySelector(".close").onclick = close;
  titleBar.classList.remove("active");
  dlg.showModal();
}

document.body.querySelector("#menuitem-about").addEventListener("click", () => {
  const dlg = document.body.querySelector("#about");
  const close = () => {
    dlg.close();
    titleBar.classList.add("active");
  };
  dlg.querySelector(".close").onclick = close;
  dlg.querySelector(".ok").onclick = close;
  dlg.querySelector(".view-notice").onclick = () => {
    openNotepad(
      "notice.txt",
      `Studio Lite is inspired by Asicosilomu's Studio Lite (https://github.com/Asicosilomu/studio-lite).

Binary decoding uses MrSprinkleToes' rbxBinaryParser
https://github.com/MrSprinkleToes/rbxBinaryParser

THREE.js is used for rendering the 3D view.
7.css is used for the Windows Aero-inspired interface.

Studio Lite is not affiliated with or endorsed by Roblox Corporation.
Roblox is a registered trademark of Roblox Corporation.`
    );
  };
  titleBar.classList.remove("active");
  dlg.showModal();
});

document.body.querySelector("#menuitem-missingassets").addEventListener("click", () => {
  openNotepad("missing_assets.txt", renderer.mAssetManager.missingAssets);
});

document.body.querySelector("#menuitem-changelog").addEventListener("click", () => {
  openNotepad(
    "changelog.txt",
    `Studio Lite Changelog

New in this build:
- Open binary RBXL / RBXM files
- Open XML RBXLX / RBXMX files (and XML saved with .rbxl)
- Built-in Lite Plaza demo
- Explorer, Properties, script viewer
- Fly camera (click-drag to look, WASD / QE)
- Render the viewport to PNG
- Click a part in the 3D view to select it
- Drag and drop a place file onto the window`
  );
});

document.body.querySelector("#menuitem-controls").addEventListener("click", () => {
  openNotepad(
    "controls.txt",
    `Viewport controls

Click + drag     Look around
Click the view   Capture mouse (Esc to release)
W A S D          Move
Q / Ctrl         Down
E / Space        Up
Shift            Sprint
Mouse wheel      Fly speed
Click a part     Select in Explorer
F                Zoom to selected part

File menu
  Render image     Save a PNG of the current view
  Missing assets   List textures/meshes that were not found
  Reload           Restart Studio Lite`
  );
});

menurender.addEventListener("click", () => {
  if (menurender.getAttribute("aria-disabled") === "true") return;
  rendering = false;
  const dlg = document.body.querySelector("#render");
  const btn = dlg.querySelector("#dorender");
  const img = dlg.querySelector("img");
  const width = dlg.querySelector("#renderwidth");
  const height = dlg.querySelector("#renderheight");
  width.value = renderer.conf.width;
  height.value = renderer.conf.height;
  const doRender = () => {
    img.src = renderer.renderImage(Number(width.value) || renderer.conf.width, Number(height.value) || renderer.conf.height);
  };
  const close = () => {
    img.src = "";
    dlg.close();
    titleBar.classList.add("active");
    rendering = true;
  };
  dlg.querySelector(".close").onclick = close;
  dlg.querySelector(".ok").onclick = close;
  btn.onclick = doRender;
  titleBar.classList.remove("active");
  dlg.showModal();
});

const examples = ["examples/Uploaded.rbxl", "examples/Lite-Plaza.rbxlx"];

function openRemoteDialog() {
  const dlg = document.body.querySelector("#remoteload");
  const txt = dlg.querySelector("input");
  const btn = dlg.querySelector(".open");
  const exp = dlg.querySelector("#examples");
  exp.innerHTML = "";
  for (const e of examples) {
    const el = document.createElement("li");
    el.role = "option";
    el.textContent = e;
    el.addEventListener("click", () => {
      txt.value = el.textContent;
      txt.dispatchEvent(new Event("input"));
    });
    exp.appendChild(el);
  }
  const close = () => {
    titleBar.classList.add("active");
    dlg.close();
  };
  dlg.querySelector(".close").onclick = close;
  dlg.querySelector(".cancel").onclick = close;
  btn.onclick = () => {
    file = txt.value;
    close();
    start();
  };
  txt.onkeyup = ({ key }) => {
    if (!btn.disabled && key === "Enter") btn.click();
  };
  txt.oninput = () => {
    btn.disabled = txt.value.trim().length === 0;
  };
  btn.disabled = true;
  txt.value = "";
  titleBar.classList.remove("active");
  dlg.showModal();
}

document.body.querySelector("#load-uploaded").addEventListener("click", async () => {
  file = "examples/Uploaded.rbxl";
  await start();
});

document.body.querySelector("#load-demo").addEventListener("click", async () => {
  if (placeLoaded && placeName === "Lite Plaza") {
    if (sal) sal.style.display = "none";
    setTitle(placeName);
    rendering = true;
    return;
  }
  print("Loading built-in Lite Plaza…");
  await startFromData(createDemoPlace(), "Lite Plaza");
});

document.body.querySelector("#load-remote").addEventListener("click", openRemoteDialog);

const browse = document.body.querySelector("#browse");
browse.addEventListener("input", () => {
  if (browse.files[0]) {
    file = browse.files[0];
    start();
  }
});

window.addEventListener("resize", () => renderer.resize());
window.addEventListener("orientationchange", () => setTimeout(() => renderer.resize(), 250));

const tree = document.body.querySelector(".tree");
const tree2 = document.body.querySelector(".tree2");
const datamodeltab = document.body.querySelector("button[aria-controls=datamodel-explorer]");
const scenetab = document.body.querySelector("button[aria-controls=scene-explorer]");
tree2.style.display = "none";

datamodeltab.addEventListener("mousedown", () => {
  datamodeltab.setAttribute("aria-selected", "true");
  scenetab.setAttribute("aria-selected", "false");
  tree2.style.display = "none";
  tree.style.display = "block";
});

let treeRefresh2Pending = false;
scenetab.addEventListener("mousedown", () => {
  datamodeltab.setAttribute("aria-selected", "false");
  scenetab.setAttribute("aria-selected", "true");
  tree.style.display = "none";
  rendering = true;
  setTitle(placeName);
  editor.innerHTML = "";
  editor.style.display = "none";
  tree2.style.display = "block";
  if (treeRefresh2Pending) {
    treeRefresh2();
    treeRefresh2Pending = false;
  }
});
datamodeltab.disabled = false;
scenetab.disabled = false;

treeRefresh2 = () => {
  if (tree2.style.display === "none") {
    treeRefresh2Pending = true;
    return;
  }
  sceneTree.setData(threeNodeToTreeData([renderer.scene]));
};

const drop = document.body.querySelector(".drop-overlay");
window.addEventListener("dragover", (e) => {
  e.preventDefault();
  drop.classList.add("show");
});
window.addEventListener("dragleave", (e) => {
  if (e.relatedTarget === null) drop.classList.remove("show");
});
window.addEventListener("drop", (e) => {
  e.preventDefault();
  drop.classList.remove("show");
  const f = e.dataTransfer.files[0];
  if (!f) return;
  file = f;
  start();
});

setTitle("Start Page");
print("Welcome to Studio Lite! (parser v4)");
print("Loading uploaded place — ~37MB, this can take a few seconds…");

sal.style.display = "none";
rendering = true;
treeRefresh2();

(async () => {
  file = "examples/Uploaded.rbxl";
  try {
    await start();
  } catch (err) {
    print("Could not auto-load uploaded place: " + err);
    if (sal) sal.style.display = "flex";
  }
})();
