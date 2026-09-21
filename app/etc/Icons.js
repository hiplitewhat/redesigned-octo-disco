const CLASS_COLORS = {
  Workspace: "#6e6e6e",
  WorldModel: "#6e6e6e",
  Model: "#8a8a8a",
  Folder: "#e0b400",
  Configuration: "#c9a227",
  Part: "#9aa0a6",
  SpawnLocation: "#3d8fd1",
  WedgePart: "#c47a3a",
  CornerWedgePart: "#c47a3a",
  MeshPart: "#7a90a8",
  UnionOperation: "#8a7a6a",
  TrussPart: "#8a8a8a",
  Seat: "#c45c26",
  VehicleSeat: "#c45c26",
  Spawn: "#3d8fd1",
  Script: "#5a5a5a",
  LocalScript: "#c9a227",
  ModuleScript: "#3d7adc",
  Camera: "#5c5c5c",
  Lighting: "#e8c547",
  Sky: "#6cb4e0",
  Players: "#3d8fd1",
  Player: "#3d8fd1",
  ReplicatedStorage: "#6e6e6e",
  ReplicatedFirst: "#6e6e6e",
  ServerStorage: "#6e6e6e",
  ServerScriptService: "#5a5a5a",
  StarterGui: "#c9a227",
  StarterPack: "#c9a227",
  StarterPlayer: "#3d8fd1",
  SoundService: "#5cb85c",
  Sound: "#5cb85c",
  Chat: "#5cb85c",
  HttpService: "#6e6e6e",
  Debris: "#6e6e6e",
  InsertService: "#6e6e6e",
  RunService: "#6e6e6e",
  TweenService: "#6e6e6e",
  UserInputService: "#6e6e6e",
  Decal: "#d4a0c8",
  Texture: "#d4a0c8",
  SpecialMesh: "#7a90a8",
  BlockMesh: "#7a90a8",
  CylinderMesh: "#7a90a8",
  FileMesh: "#7a90a8",
  Humanoid: "#e07a7a",
  Accessory: "#c9a227",
  Hat: "#c9a227",
  Tool: "#c9a227",
  HopperBin: "#c9a227",
  ClickDetector: "#e07a7a",
  ProximityPrompt: "#e07a7a",
  SurfaceGui: "#c9a227",
  BillboardGui: "#c9a227",
  ScreenGui: "#c9a227",
  Frame: "#d0d0d0",
  TextLabel: "#d0d0d0",
  TextButton: "#d0d0d0",
  ImageLabel: "#d4a0c8",
  ImageButton: "#d4a0c8",
  ParticleEmitter: "#e8c547",
  Fire: "#e07030",
  Smoke: "#9aa0a6",
  Sparkles: "#e8c547",
  PointLight: "#e8c547",
  SpotLight: "#e8c547",
  SurfaceLight: "#e8c547",
  Attachment: "#9aa0a6",
  Weld: "#9aa0a6",
  WeldConstraint: "#9aa0a6",
  Motor6D: "#9aa0a6",
  VectorForce: "#e07a7a",
  BodyGyro: "#e07a7a",
  BodyVelocity: "#e07a7a",
  Terrain: "#5cb85c",
  DataModel: "#6e6e6e",
  SelectionBox: "#ffffff",
  BoxHandleAdornment: "#ffffff",
  AmbientLight: "#e8c547",
  DirectionalLight: "#e8c547",
  Mesh: "#9aa0a6",
  BoxHelper: "#ffffff",
  Scene: "#6e6e6e",
  Group: "#8a8a8a",
  Object3D: "#8a8a8a",
};

function hashColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 42%, 48%)`;
}

const iconCache = new Map();

export function iconFor(className) {
  const key = className || "Instance";
  if (iconCache.has(key)) return iconCache.get(key);
  const color = CLASS_COLORS[key] || hashColor(key);
  const letter = (key[0] || "?").toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
    <rect x="0.5" y="0.5" width="15" height="15" rx="3" fill="${color}" stroke="rgba(0,0,0,.35)"/>
    <text x="8" y="12" text-anchor="middle" font-size="9" font-family="Tahoma,Segoe UI,sans-serif" fill="white" font-weight="700">${letter}</text>
  </svg>`;
  const uri = "data:image/svg+xml," + encodeURIComponent(svg);
  iconCache.set(key, uri);
  return uri;
}

export const THREE_CLASS_ICONS = {
  AmbientLight: "Lighting",
  DirectionalLight: "Lighting",
  HemisphereLight: "Lighting",
  Mesh: "Part",
  BoxHelper: "SelectionBox",
  Scene: "Workspace",
  Group: "Model",
  PerspectiveCamera: "Camera",
  AxesHelper: "Attachment",
};
