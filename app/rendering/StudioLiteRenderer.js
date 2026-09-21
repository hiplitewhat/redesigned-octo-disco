import * as THREE from "three";
import { decode } from "../datamodel/BinaryParser.js?v=5";
import FlyCamera from "../controls/FlyCamera.js?v=5";
import { findByClassName } from "../datamodel/DataModelUtils.js?v=5";
import { decodeXml } from "../datamodel/XmlParser.js?v=5";
import { parseMesh } from "./mesh/MeshParser.js?v=5";
import { tryToFetch } from "../http/TryToFetch.js?v=5";
import AssetManager from "../http/AssetManager.js?v=5";
import { rotationMatrixFromCFrame, sniffRobloxFile } from "../etc/Helpers.js?v=5";

const decalSides = ["Right", "Left", "Top", "Bottom", "Back", "Front"];
export const partClasses = [
  "Part",
  "SpawnLocation",
  "WedgePart",
  "Seat",
  "VehicleSeat",
  "MeshPart",
  "TrussPart",
  "CornerWedgePart",
];

function makeSkyCanvas(kind) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (kind === "up") {
    const g = ctx.createRadialGradient(128, 128, 20, 128, 128, 180);
    g.addColorStop(0, "#c8e6ff");
    g.addColorStop(1, "#5ba3d9");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  } else if (kind === "dn") {
    ctx.fillStyle = "#3d6b3a";
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "#4a7a45";
    for (let i = 0; i < 40; i++) {
      ctx.fillRect((i * 37) % 256, (i * 53) % 256, 8, 8);
    }
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "#5ba3d9");
    g.addColorStop(0.42, "#a8d4f0");
    g.addColorStop(0.55, "#d9c9a8");
    g.addColorStop(1, "#6a8f4e");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  }
  return canvas;
}

export class StudioLiteRenderer {
  constructor(conf) {
    this.conf = conf;
    this.queue = { total: 0, completed: 0 };
    this.mAssetManager = new AssetManager({
      sharedFunctions: { print: this.conf.sharedFunctions.print },
    });
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, this.conf.width / this.conf.height, 0.1, 250000);
    this.camera.rotation.order = "YXZ";
    this.camera.position.set(28, 16, 36);
    this.camera.lookAt(0, 4, 0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.autoClear = false;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(this.conf.width, this.conf.height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x000000, 0);
    this.domElement = this.renderer.domElement;
    this.domElement.tabIndex = 0;
    this.loader = new THREE.TextureLoader();
    this.loader.crossOrigin = "Anonymous";
    this.clock = new THREE.Clock();

    this.sun = new THREE.DirectionalLight(0xffffff, 1.15);
    this.sun.position.set(40, 80, 30);
    this.sun.name = "Sun";
    this.scene.add(this.sun);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.45);
    this.ambient.name = "Ambient";
    this.scene.add(this.ambient);

    this.controls = new FlyCamera(this.camera, this.domElement);
    this.axesHelper = new THREE.AxesHelper(20);
    this.axesHelper.name = "AxesHelper";
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.threeids = [];
    this.meshToInstance = new Map();
    this.useSelectionBox = true;
    this.useSelectionBox2 = true;
    this.noWorkspace = false;
    this.skyboxVisible = true;

    this._onMouseMoveHover = (event) => {
      if (!this.useSelectionBox2) return;
      const rect = event.target.getBoundingClientRect();
      this.pointer.x = ((event.clientX - rect.left) / this.conf.width) * 2 - 1;
      this.pointer.y = -((event.clientY - rect.top) / this.conf.height) * 2 + 1;
    };
    this.domElement.addEventListener("mousemove", this._onMouseMoveHover);

    this.buildProceduralSkybox();
  }

  buildProceduralSkybox() {
    const faces = ["rt", "lf", "up", "dn", "ft", "bk"].map((kind) => {
      const map = ["rt", "lf"].includes(kind) ? "side" : kind;
      const canvas = makeSkyCanvas(map === "side" ? "side" : kind);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false });
      return mat;
    });
    const geometry = new THREE.BoxGeometry(200000, 200000, 200000);
    if (this.skybox) this.scene.remove(this.skybox);
    this.skybox = new THREE.Mesh(geometry, faces);
    this.skybox.name = "Skybox";
    this.skybox.raycast = () => {};
    if (this.skyboxVisible) this.scene.add(this.skybox);
  }

  render() {
    if (this.controls) this.controls.update(this.clock.getDelta());
    this.renderer.render(this.scene, this.camera);
    if (this.useSelectionBox2) {
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster.intersectObjects(this.scene.children, false);
      const hit = hits.find((h) => h.object !== this.skybox && h.object !== this.axesHelper);
      if (hit) this.updateSelectionBox2(hit.object);
    }
  }

  renderImage(width = this.conf.width, height = this.conf.height) {
    if (this.selectionBox) this.scene.remove(this.selectionBox);
    if (this.selectionBox2) this.scene.remove(this.selectionBox2);
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
    const result = this.domElement.toDataURL("image/png");
    this.resize();
    if (this.selectionBox) this.scene.add(this.selectionBox);
    if (this.selectionBox2) this.scene.add(this.selectionBox2);
    return result;
  }

  setAnimationLoop(cb) {
    this.renderer.setAnimationLoop(cb);
  }

  resize() {
    this.renderer.setSize(this.conf.width, this.conf.height);
    this.camera.aspect = this.conf.width / this.conf.height;
    this.camera.updateProjectionMatrix();
  }

  toggleAxes(axes) {
    if (axes) this.scene.add(this.axesHelper);
    else this.scene.remove(this.axesHelper);
  }

  setAxesPosition(x, y, z) {
    this.axesHelper.position.set(x, y, z);
  }

  zoomTo(cameraFrame, rotate = true) {
    if (!cameraFrame) return;
    const p = cameraFrame.Position || cameraFrame;
    this.camera.position.set(p.X ?? p.x ?? 0, p.Y ?? p.y ?? 0, p.Z ?? p.z ?? 0);
    if (rotate && cameraFrame.Components) {
      this.camera.setRotationFromMatrix(new THREE.Matrix4().fromArray(rotationMatrixFromCFrame(cameraFrame)));
      this.camera.rotation.order = "YXZ";
      if (this.controls) this.controls.syncEulerFromCamera();
    } else if (this.controls) {
      this.controls.syncEulerFromCamera();
    }
  }

  lookAtPart(instance) {
    const cf = instance.CFrame || instance.CoordinateFrame;
    if (!cf || !cf.Position) return;
    const p = cf.Position;
    const size = instance.Size || { X: 4, Y: 4, Z: 4 };
    const dist = Math.max(size.X, size.Y, size.Z) * 2.4 + 6;
    this.camera.position.set(p.X + dist * 0.6, p.Y + dist * 0.45, p.Z + dist * 0.6);
    this.camera.lookAt(p.X, p.Y, p.Z);
    this.camera.rotation.order = "YXZ";
    if (this.controls) this.controls.syncEulerFromCamera();
  }

  updateSelectionBox(threeid) {
    if (!this.useSelectionBox) return;
    if (threeid === 1 || threeid == null) return;
    const mesh = this.scene.getObjectById(threeid);
    if (!mesh) return;
    if (this.selectionBox) {
      this.selectionBox.setFromObject(mesh);
    } else {
      this.selectionBox = new THREE.BoxHelper(mesh, new THREE.Color(1, 1, 1));
      this.selectionBox.name = "Selection";
      this.scene.add(this.selectionBox);
      this.conf.sharedFunctions.treeRefresh2();
    }
  }

  updateSelectionBox2(mesh) {
    if (!this.useSelectionBox2) return;
    if (!mesh || mesh === this.skybox) return;
    if (this.selectionBox2) {
      this.selectionBox2.setFromObject(mesh);
    } else {
      this.selectionBox2 = new THREE.BoxHelper(mesh, new THREE.Color(1, 1, 1));
      this.selectionBox2.name = "Hover";
      this.scene.add(this.selectionBox2);
      this.conf.sharedFunctions.treeRefresh2();
    }
  }

  removeSelectionBoxesIfNeeded() {
    if (!this.useSelectionBox && this.selectionBox) {
      this.scene.remove(this.selectionBox);
      this.selectionBox.dispose();
      this.selectionBox = null;
    }
    if (!this.useSelectionBox2 && this.selectionBox2) {
      this.scene.remove(this.selectionBox2);
      this.selectionBox2.dispose();
      this.selectionBox2 = null;
    }
    this.conf.sharedFunctions.treeRefresh2();
  }

  showSkybox(show) {
    this.skyboxVisible = show;
    if (!this.skybox) return;
    if (show) this.scene.add(this.skybox);
    else this.scene.remove(this.skybox);
  }

  getThreeId(id) {
    return this.threeids[id];
  }

  pickInstanceAt(clientX, clientY) {
    const rect = this.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((clientX - rect.left) / this.conf.width) * 2 - 1,
      -((clientY - rect.top) / this.conf.height) * 2 + 1
    );
    this.raycaster.setFromCamera(pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.scene.children, false);
    for (const hit of hits) {
      if (
        hit.object === this.skybox ||
        hit.object === this.axesHelper ||
        hit.object === this.selectionBox ||
        hit.object === this.selectionBox2 ||
        hit.object.isLineSegments
      ) {
        continue;
      }
      const inst = this.meshToInstance.get(hit.object.id);
      if (inst) return { mesh: hit.object, instance: inst.instance, treeId: inst.treeId };
    }
    return null;
  }

  async setSkybox(sky) {
    if (this.skybox) this.scene.remove(this.skybox);
    const paths = [
      await this.mAssetManager.parseAssetPath(sky.SkyboxFt),
      await this.mAssetManager.parseAssetPath(sky.SkyboxBk),
      await this.mAssetManager.parseAssetPath(sky.SkyboxUp),
      await this.mAssetManager.parseAssetPath(sky.SkyboxDn),
      await this.mAssetManager.parseAssetPath(sky.SkyboxRt),
      await this.mAssetManager.parseAssetPath(sky.SkyboxLf),
    ];
    if (paths.some((p) => !p)) {
      this.buildProceduralSkybox();
      return;
    }
    const material = [];
    for (const path of paths) {
      const mat = new THREE.MeshBasicMaterial({
        map: this.loadColorTexture(path),
        side: THREE.BackSide,
        depthWrite: false,
      });
      material.push(mat);
    }
    const geometry = new THREE.BoxGeometry(200000, 200000, 200000);
    this.skybox = new THREE.Mesh(geometry, material);
    this.skybox.position.set(0, 0, 0);
    this.skybox.name = "Skybox";
    this.skybox.raycast = () => {};
    if (this.skyboxVisible) this.scene.add(this.skybox);
    console.log("skybox added");
    this.conf.sharedFunctions.treeRefresh2();
  }

  queueOperation(cb) {
    (async () => {
      this.queue.total++;
      try {
        await cb();
      } finally {
        this.queue.completed++;
      }
    })();
  }

  get queueSize() {
    return this.queue.total - this.queue.completed;
  }

  clearPlaceMeshes() {
    const keep = new Set([this.sun, this.ambient, this.axesHelper, this.skybox]);
    const toRemove = [];
    this.scene.traverse((obj) => {
      if (obj === this.scene) return;
      if (keep.has(obj)) return;
      if (obj.parent === this.scene) toRemove.push(obj);
    });
    for (const obj of toRemove) {
      this.scene.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
    }
    this.threeids = [];
    this.meshToInstance = new Map();
    this.selectionBox = null;
    this.selectionBox2 = null;
    this.queue = { total: 0, completed: 0 };
    this.mAssetManager.reset();
  }

  partColor(part) {
    if (part.Color3) return new THREE.Color(part.Color3.R, part.Color3.G, part.Color3.B);
    if (part.Color) return new THREE.Color(part.Color.R, part.Color.G, part.Color.B);
    if (part.BrickColor && part.BrickColor.Color) {
      return new THREE.Color(
        part.BrickColor.Color.R / 255,
        part.BrickColor.Color.G / 255,
        part.BrickColor.Color.B / 255
      );
    }
    return new THREE.Color(0.64, 0.64, 0.64);
  }

  applyMaterialStyle(material, part) {
    const matName = part.Material;
    if (matName === "Neon") {
      material.emissive = material.color.clone();
      material.emissiveIntensity = 0.85;
      material.specular = new THREE.Color(0x111111);
    } else if (matName === "Glass" || matName === "ForceField") {
      material.transparent = true;
      material.opacity = Math.min(material.opacity, 0.45);
      material.specular = new THREE.Color(0xeeeeee);
      material.shininess = 80;
    } else if (matName === "Metal" || matName === "DiamondPlate" || matName === "CorrodedMetal") {
      material.specular = new THREE.Color(0x888888);
      material.shininess = 60;
    }
    return material;
  }

  async renderPart(part, forceNoMesh = false, mappedid) {
    const transparent = (part.Transparency || 0) > 0;
    let geometry;
    const decals = [];
    let offset = { x: 0, y: 0, z: 0 };
    let scale = { x: 1, y: 1, z: 1 };
    const size = part.Size || { X: 4, Y: 1, Z: 2 };
    const cf = part.CFrame || part.CoordinateFrame;
    if (!cf || !cf.Position) return;

    let mesh = findByClassName(part.Children || [], "SpecialMesh");
    if (!mesh && part.ClassName === "MeshPart") mesh = part;

    const color = this.partColor(part);

    const blockMesh = mesh && mesh !== part ? mesh : findByClassName(part.Children || [], "BlockMesh");
    if (blockMesh && blockMesh.Scale) {
      scale = { x: blockMesh.Scale.X || 1, y: blockMesh.Scale.Y || 1, z: blockMesh.Scale.Z || 1 };
      offset = { x: 0, y: (blockMesh.Offset && blockMesh.Offset.Y) || 0, z: 0 };
    }

    if (part.Shape === "Ball" || part.Shape === 0) {
      geometry = new THREE.SphereGeometry(size.X / 2, 16, 12);
    } else if (part.Shape === "Cylinder" || part.Shape === 2 || (mesh && mesh.MeshType === "Head")) {
      let x, y, z;
      if (part.Shape === "Cylinder" || part.Shape === 2) {
        x = size.X;
        y = size.Y;
        z = size.Z;
      } else {
        x = size.Y;
        y = size.X;
        z = size.Z;
      }
      const cylinderRadius = Math.min(y, z) / 2;
      geometry = new THREE.CylinderGeometry(cylinderRadius, cylinderRadius, x, 16, 1);
    } else if (!forceNoMesh && mesh && (mesh.MeshType === "FileMesh" || part.ClassName === "MeshPart") && (mesh.MeshId || part.MeshId)) {
      this.queueOperation(async () => {
        try {
          const meshId = mesh.MeshId || part.MeshId;
          const textureId = mesh.TextureId || part.TextureID || part.TextureId || "";
          const meshData = await this.getMesh(meshId, this.mAssetManager.getAssetId(textureId));
          const { positions, normal, uv } = parseMesh(meshData, meshId);
          const geo = new THREE.BufferGeometry();
          geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
          geo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(normal), 3));
          geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uv), 2));
          geo.computeBoundingBox();
          const box = geo.boundingBox;
          const dx = box.max.x - box.min.x || 1;
          const dy = box.max.y - box.min.y || 1;
          const dz = box.max.z - box.min.z || 1;
          geo.scale(size.X / dx, size.Y / dy, size.Z / dz);

          const material = new THREE.MeshPhongMaterial({
            map: this.loadColorTexture(await this.mAssetManager.parseAssetPath(textureId)),
            transparent,
            opacity: 1 - (part.Transparency || 0),
            specular: 0x222222,
          });
          this.applyMaterialStyle(material, part);
          const cube = new THREE.Mesh(geo, material);
          cube.receiveShadow = true;
          cube.castShadow = true;
          cube.name = part.Name;
          cube.position.set(cf.Position.X, cf.Position.Y, cf.Position.Z);
          if (cf.Components) cube.setRotationFromMatrix(new THREE.Matrix4().fromArray(rotationMatrixFromCFrame(cf)));
          this.scene.add(cube);
          if (mappedid != null) {
            this.threeids[mappedid] = cube.id;
            this.meshToInstance.set(cube.id, { instance: part, treeId: mappedid });
          }
        } catch {
          this.renderPart(part, true, mappedid);
        }
      });
      return;
    } else {
      geometry = new THREE.BoxGeometry(size.X * scale.x, size.Y * scale.y, size.Z * scale.z);
    }

    if (part.ClassName === "WedgePart") {
      const pos = geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        if (pos.getZ(i) < 0 && pos.getY(i) > 0) pos.setY(i, (size.Y / 2) * -1);
      }
      geometry.computeVertexNormals();
    }

    if (part.ClassName === "CornerWedgePart") {
      const pos = geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        if (pos.getX(i) > 0 && pos.getZ(i) > 0 && pos.getY(i) > 0) pos.setY(i, (size.Y / 2) * -1);
      }
      geometry.computeVertexNormals();
    }

    for (const child of part.Children || []) {
      if (child.ClassName === "Decal" || child.ClassName === "Texture") decals.push(child);
    }

    const renderPartStageTwo = async () => {
      let material;
      if (decals.length > 0) {
        material = [null, null, null, null, null, null];
        for (const decal of decals) {
          const index = decalSides.indexOf(decal.Face);
          if (index !== -1) {
            material[index] = new THREE.MeshPhongMaterial({
              map: this.loadColorTexture(await this.mAssetManager.parseAssetPath(decal.Texture)),
              transparent: (decal.Transparency || 0) > 0,
              opacity: 1 - (decal.Transparency || 0),
              specular: 0x222222,
            });
          }
        }
        for (let i = 0; i < material.length; i++) {
          if (material[i] === null) {
            material[i] = this.applyMaterialStyle(
              new THREE.MeshPhongMaterial({
                color,
                transparent,
                opacity: 1 - (part.Transparency || 0),
                specular: 0x222222,
              }),
              part
            );
          }
        }
      } else {
        material = this.applyMaterialStyle(
          new THREE.MeshPhongMaterial({
            color,
            transparent,
            opacity: 1 - (part.Transparency || 0),
            specular: 0x222222,
          }),
          part
        );
      }

      const cube = new THREE.Mesh(geometry, material);
      cube.receiveShadow = true;
      cube.castShadow = true;
      cube.name = part.Name;
      cube.position.set(cf.Position.X + offset.x, cf.Position.Y + offset.y, cf.Position.Z + offset.z);
      if (cf.Components) cube.setRotationFromMatrix(new THREE.Matrix4().fromArray(rotationMatrixFromCFrame(cf)));
      if (part.Shape === "Cylinder" || part.Shape === 2) cube.rotation.z += Math.PI / 2;
      this.scene.add(cube);
      if (mappedid != null) {
        this.threeids[mappedid] = cube.id;
        this.meshToInstance.set(cube.id, { instance: part, treeId: mappedid });
      }
    };

    if (decals.length > 0) this.queueOperation(renderPartStageTwo);
    else await renderPartStageTwo();
  }

  async traverse(instance, treeData, render = false) {
    for (const child of instance.Children || []) {
      if (!child) continue;
      const item = {
        text: child.Name || child.ClassName,
        className: child.ClassName,
        children: [],
        instance: child,
        id: this.threeids.push(1) - 1,
      };
      treeData.push(item);
      if (render && partClasses.indexOf(child.ClassName) !== -1) {
        await this.renderPart(child, false, item.id);
        if (this.threeids.length % 80 === 0) {
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      await this.traverse(child, item.children, render ? true : child.ClassName === "Workspace" || this.noWorkspace);
    }
  }

  loadColorTexture(path) {
    if (!path || !String(path).trim()) return new THREE.DataTexture(new Uint8Array(4), 1, 1);
    this.conf.sharedFunctions.print("Load texture " + new URL(path, window.location.href));
    const texture = this.loader.load(path);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  async getMesh(mesh, texture) {
    const path = await this.mAssetManager.parseAssetPath(mesh, "mesh", texture);
    if (!path || !path.trim()) throw new Error("Missing mesh");
    const d = await fetch(path);
    return d.arrayBuffer();
  }

  applyLighting(data) {
    const lighting = findByClassName(data, "Lighting");
    if (!lighting) return;
    if (lighting.Ambient) {
      const a = lighting.Ambient;
      this.ambient.color.setRGB(a.R ?? 0.4, a.G ?? 0.4, a.B ?? 0.4);
    }
    if (lighting.Brightness != null) {
      this.sun.intensity = 0.6 + Number(lighting.Brightness) * 0.4;
    }
  }

  frameRenderedParts() {
    const box = new THREE.Box3();
    let any = false;
    for (const child of this.scene.children) {
      if (child.isMesh && child !== this.skybox && !child.isLineSegments) {
        box.expandByObject(child);
        any = true;
      }
    }
    if (!any || box.isEmpty()) return;
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 4);
    const dist = maxDim * 1.35 + 12;
    this.camera.near = Math.max(0.1, maxDim / 2000);
    this.camera.far = Math.max(50000, maxDim * 40);
    this.camera.updateProjectionMatrix();
    this.camera.position.set(center.x + dist * 0.7, center.y + dist * 0.4, center.z + dist * 0.7);
    this.camera.lookAt(center);
    this.camera.rotation.order = "YXZ";
    if (this.controls) this.controls.syncEulerFromCamera();
    this.sun.position.set(center.x + maxDim, center.y + maxDim, center.z + maxDim * 0.5);
    if (this.skybox) this.skybox.position.copy(center);
    this.conf.sharedFunctions.print(
      `Framed ${Math.round(size.x)}×${Math.round(size.y)}×${Math.round(size.z)} studs at (${center.x.toFixed(1)}, ${center.y.toFixed(1)}, ${center.z.toFixed(1)})`
    );
  }

  async loadDataModel(data, treeTarget) {
    const meaningful = (data || []).filter(
      (n) => n && ((n.Children && n.Children.length) || partClasses.indexOf(n.ClassName) !== -1)
    );
    if (meaningful.length) data = meaningful;
    this.data = data;
    this.clearPlaceMeshes();
    this.buildProceduralSkybox();
    this.applyLighting(data);

    const workspace = findByClassName(data, "Workspace");
    this.noWorkspace = !workspace;
    let placedCamera = false;
    try {
      const root = this.noWorkspace ? findByClassName(data, "Model") : workspace;
      const robloxCamera = findByClassName((root && root.Children) || [], "Camera");
      const cameraFrame = robloxCamera && (robloxCamera.CFrame || robloxCamera.CoordinateFrame);
      if (cameraFrame) {
        this.zoomTo(cameraFrame, false);
        placedCamera = true;
      }
    } catch {
      this.conf.sharedFunctions.print("Could not determine camera position!");
    }

    this.queueOperation(async () => {
      try {
        const lighting = findByClassName(this.data, "Lighting");
        const sky = lighting && findByClassName(lighting.Children, "Sky");
        if (!sky) return;
        try {
          for (const key of ["Bk", "Dn", "Ft", "Lf", "Rt", "Up"]) {
            const path = await this.mAssetManager.parseAssetPath(sky["Skybox" + key]);
            if (!(await tryToFetch(path))) throw new Error();
          }
          await this.setSkybox(sky);
        } catch {
          this.conf.sharedFunctions.print("Could not load sky — using built-in sky.");
        }
      } catch {
        /* no lighting/sky */
      }
    });

    treeTarget.length = 0;
    await this.traverse({ Children: this.data }, treeTarget);
    if (!placedCamera) this.frameRenderedParts();
  }

  async loadPlace(ab) {
    const kind = sniffRobloxFile(ab);
    let data;
    if (kind === "xml") {
      data = decodeXml(ab);
    } else if (kind === "binary") {
      console.log("Decoding with Studio Lite parser v4…");
      data = decode(ab);
    } else {
      try {
        data = decode(ab);
      } catch {
        data = decodeXml(ab);
      }
    }
    if (!data || !data.length) throw new Error("Empty DataModel");
    await this.loadDataModel(data, this.conf.sharedObjects.jsTreeData);
  }
}
