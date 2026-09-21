import { cframe, color3, vec3 } from "../etc/Helpers.js?v=5";
import { instance } from "../datamodel/DataModelUtils.js?v=5";

function part({
  name = "Part",
  className = "Part",
  size = [4, 1, 2],
  pos = [0, 0.5, 0],
  rot = null,
  color = [0.64, 0.64, 0.64],
  transparency = 0,
  shape = "Block",
  material = "Plastic",
  children = [],
  extra = {},
}) {
  return instance(
    className,
    name,
    {
      Size: vec3(size[0], size[1], size[2]),
      CFrame: cframe(pos[0], pos[1], pos[2], rot),
      Color3: color3(color[0], color[1], color[2]),
      Color: color3(color[0], color[1], color[2]),
      Transparency: transparency,
      Shape: shape,
      Material: material,
      Anchored: true,
      CanCollide: true,
      TopSurface: "Smooth",
      BottomSurface: "Smooth",
      ...extra,
    },
    children
  );
}

function tree(x, z, height = 8) {
  return instance("Model", "Tree", { PrimaryPart: "Trunk" }, [
    part({
      name: "Trunk",
      size: [1.4, height, 1.4],
      pos: [x, height / 2, z],
      color: [0.42, 0.27, 0.14],
      material: "Wood",
    }),
    part({
      name: "Leaves",
      shape: "Ball",
      size: [7, 7, 7],
      pos: [x, height + 1.2, z],
      color: [0.16, 0.55, 0.22],
      material: "Grass",
    }),
    part({
      name: "Leaves2",
      shape: "Ball",
      size: [5, 5, 5],
      pos: [x + 1.6, height + 2.2, z - 0.8],
      color: [0.2, 0.62, 0.28],
      material: "Grass",
    }),
  ]);
}

function lamp(x, z) {
  return instance("Model", "LampPost", {}, [
    part({
      name: "Pole",
      size: [0.5, 12, 0.5],
      pos: [x, 6, z],
      color: [0.18, 0.18, 0.2],
      material: "Metal",
    }),
    part({
      name: "Lamp",
      shape: "Ball",
      size: [1.8, 1.8, 1.8],
      pos: [x, 12.4, z],
      color: [1, 0.92, 0.55],
      material: "Neon",
    }),
  ]);
}

const WELCOME_SOURCE = `-- Welcome to Studio Lite
-- This is a LocalScript living in the demo place.

local message = "Hello from Lite Plaza!"
print(message)

local spawn = workspace:FindFirstChild("SpawnLocation")
if spawn then
    print("Spawn is at", spawn.Position)
end
`;

const SERVER_SOURCE = `-- Server script
-- Studio Lite can display script source from RBXL/RBXM files.

game.Players.PlayerAdded:Connect(function(player)
    print(player.Name .. " joined Lite Plaza")
end)
`;

const MODULE_SOURCE = `-- ModuleScript
local Plaza = {}

function Plaza.greeting(name)
    return ("Welcome to Lite Plaza, %s!"):format(name or "adventurer")
end

return Plaza
`;

export function createDemoPlace() {
  const tiles = [];
  const palette = [
    [0.95, 0.85, 0.2],
    [0.2, 0.55, 0.95],
    [0.9, 0.25, 0.22],
    [0.2, 0.75, 0.45],
    [0.95, 0.5, 0.15],
    [0.7, 0.35, 0.85],
  ];
  let n = 0;
  for (let ix = -1; ix <= 1; ix++) {
    for (let iz = -1; iz <= 1; iz++) {
      if (ix === 0 && iz === 0) continue;
      tiles.push(
        part({
          name: "Tile",
          size: [4, 0.25, 4],
          pos: [ix * 5, 0.2, iz * 5],
          color: palette[n++ % palette.length],
        })
      );
    }
  }

  const house = instance("Model", "Red House", {}, [
    part({ name: "Floor", size: [20, 1, 16], pos: [-32, 0.5, 0], color: [0.55, 0.38, 0.22], material: "WoodPlanks" }),
    part({ name: "WallNorth", size: [20, 10, 1], pos: [-32, 6, -7.5], color: [0.82, 0.22, 0.18] }),
    part({ name: "WallSouth", size: [20, 10, 1], pos: [-32, 6, 7.5], color: [0.82, 0.22, 0.18] }),
    part({ name: "WallWest", size: [1, 10, 14], pos: [-41.5, 6, 0], color: [0.82, 0.22, 0.18] }),
    part({ name: "WallEastL", size: [1, 10, 5], pos: [-22.5, 6, -4.5], color: [0.82, 0.22, 0.18] }),
    part({ name: "WallEastR", size: [1, 10, 5], pos: [-22.5, 6, 4.5], color: [0.82, 0.22, 0.18] }),
    part({ name: "Lintel", size: [1, 2, 5], pos: [-22.5, 10, 0], color: [0.82, 0.22, 0.18] }),
    part({
      name: "Door",
      size: [0.4, 8, 4],
      pos: [-22.2, 5, 0],
      color: [0.32, 0.18, 0.1],
      material: "Wood",
    }),
    part({
      name: "WindowL",
      size: [0.3, 4, 4],
      pos: [-32, 6.5, -7.2],
      color: [0.55, 0.8, 0.95],
      transparency: 0.45,
      material: "Glass",
    }),
    part({
      name: "WindowR",
      size: [0.3, 4, 4],
      pos: [-32, 6.5, 7.2],
      color: [0.55, 0.8, 0.95],
      transparency: 0.45,
      material: "Glass",
    }),
    part({
      name: "RoofA",
      className: "WedgePart",
      size: [20, 6, 8],
      pos: [-32, 13.5, -4],
      color: [0.35, 0.2, 0.14],
      material: "Slate",
    }),
    part({
      name: "RoofB",
      className: "WedgePart",
      size: [20, 6, 8],
      pos: [-32, 13.5, 4],
      rot: [0, 180, 0],
      color: [0.35, 0.2, 0.14],
      material: "Slate",
    }),
    part({ name: "Chimney", size: [2.2, 6, 2.2], pos: [-38, 16, -3], color: [0.45, 0.22, 0.18], material: "Brick" }),
  ]);

  const fountain = instance("Model", "Fountain", {}, [
    part({ name: "Basin", size: [14, 1, 14], pos: [28, 0.6, 0], color: [0.72, 0.72, 0.75], material: "Marble" }),
    part({
      name: "Water",
      size: [12, 0.6, 12],
      pos: [28, 1.15, 0],
      color: [0.2, 0.55, 0.9],
      transparency: 0.35,
      material: "Glass",
    }),
    part({ name: "Pedestal", size: [2, 6, 2], pos: [28, 4, 0], color: [0.8, 0.8, 0.82], material: "Marble" }),
    part({
      name: "Orb",
      shape: "Ball",
      size: [3.2, 3.2, 3.2],
      pos: [28, 8.2, 0],
      color: [0.35, 0.85, 1],
      material: "Neon",
    }),
  ]);

  const obby = instance("Model", "Sky Platforms", {}, [
    part({ name: "Pad1", size: [6, 1, 6], pos: [8, 4, -28], color: [0.95, 0.3, 0.25] }),
    part({ name: "Pad2", size: [6, 1, 6], pos: [16, 7, -34], color: [0.95, 0.7, 0.2] }),
    part({ name: "Pad3", size: [6, 1, 6], pos: [26, 10, -30], color: [0.3, 0.85, 0.4] }),
    part({ name: "Pad4", size: [6, 1, 6], pos: [36, 13, -36], color: [0.3, 0.55, 0.95] }),
    part({
      name: "Ramp",
      className: "WedgePart",
      size: [6, 4, 10],
      pos: [8, 2.5, -20],
      color: [0.85, 0.85, 0.9],
    }),
    part({
      name: "Goal",
      shape: "Ball",
      size: [3, 3, 3],
      pos: [36, 16, -36],
      color: [1, 0.92, 0.2],
      material: "Neon",
    }),
  ]);

  const camera = instance("Camera", "Camera", {
    CFrame: cframe(40, 18, 48),
    FieldOfView: 70,
    CameraType: "Custom",
  });

  const spawn = part({
    name: "SpawnLocation",
    className: "SpawnLocation",
    size: [6, 1, 6],
    pos: [0, 0.55, 0],
    color: [0.2, 0.45, 0.95],
    extra: { Neutral: true, Duration: 0 },
  });

  const welcomeScript = instance("LocalScript", "Welcome", {
    Source: WELCOME_SOURCE,
    Enabled: true,
    RunContext: "Legacy",
  });

  const workspace = instance("Workspace", "Workspace", {
    FilteringEnabled: true,
    Gravity: 196.2,
    FallenPartsDestroyHeight: -500,
  }, [
    camera,
    part({
      name: "Baseplate",
      size: [120, 1, 120],
      pos: [0, -0.5, 0],
      color: [0.2, 0.72, 0.28],
      material: "Grass",
    }),
    spawn,
    part({
      name: "Path",
      size: [10, 0.2, 70],
      pos: [0, 0.1, 8],
      color: [0.5, 0.5, 0.52],
      material: "Cobblestone",
    }),
    ...tiles,
    house,
    fountain,
    obby,
    tree(-12, 22),
    tree(-20, 18, 10),
    tree(12, 24, 9),
    tree(18, 16),
    tree(-8, -22, 11),
    tree(42, 12, 8),
    lamp(-10, 10),
    lamp(10, 10),
    lamp(-22, -12),
    lamp(40, -8),
    part({
      name: "Sign",
      size: [12, 5, 0.6],
      pos: [0, 4, 22],
      color: [0.12, 0.12, 0.16],
      material: "SmoothPlastic",
    }),
    part({
      name: "SignGlow",
      size: [10.5, 3.4, 0.4],
      pos: [0, 4.2, 21.7],
      color: [0.45, 0.85, 1],
      material: "Neon",
    }),
    part({
      name: "Bench",
      size: [6, 0.4, 1.6],
      pos: [14, 1.4, 10],
      color: [0.45, 0.28, 0.14],
      material: "Wood",
    }),
    welcomeScript,
  ]);

  const lighting = instance("Lighting", "Lighting", {
    Ambient: color3(0.42, 0.42, 0.48),
    OutdoorAmbient: color3(0.5, 0.5, 0.55),
    Brightness: 2,
    ClockTime: 14,
    TimeOfDay: "14:00:00",
    FogColor: color3(0.75, 0.82, 0.9),
    FogEnd: 100000,
    GeographicLatitude: 41.7,
    GlobalShadows: true,
    Technology: "Legacy",
  }, [
    instance("Sky", "Sky", {
      SkyboxBk: "",
      SkyboxDn: "",
      SkyboxFt: "",
      SkyboxLf: "",
      SkyboxRt: "",
      SkyboxUp: "",
      StarCount: 3000,
    }),
  ]);

  return [
    workspace,
    lighting,
    instance("Players", "Players", { MaxPlayers: 12, CharacterAutoLoads: true }),
    instance("ReplicatedStorage", "ReplicatedStorage", {}, [
      instance("ModuleScript", "Plaza", { Source: MODULE_SOURCE }),
    ]),
    instance("ServerScriptService", "ServerScriptService", {}, [
      instance("Script", "JoinLogger", { Source: SERVER_SOURCE, Enabled: true }),
    ]),
    instance("ReplicatedFirst", "ReplicatedFirst"),
    instance("ServerStorage", "ServerStorage"),
    instance("StarterGui", "StarterGui", { ResetPlayerGuiOnSpawn: true }),
    instance("StarterPack", "StarterPack"),
    instance("StarterPlayer", "StarterPlayer", { CharacterWalkSpeed: 16, CharacterJumpPower: 50 }),
    instance("SoundService", "SoundService", { AmbientReverb: "NoReverb" }),
    instance("Chat", "Chat"),
    instance("HttpService", "HttpService", { HttpEnabled: false }),
    instance("Debris", "Debris"),
    instance("InsertService", "InsertService"),
  ];
}
