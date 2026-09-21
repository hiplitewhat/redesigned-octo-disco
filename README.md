# Studio Lite

A web viewer for **Roblox** place and model files, with a Windows Aero interface.

Open binary `.rbxl` / `.rbxm` files or XML `.rbxlx` / `.rbxmx` files in the browser. Browse the DataModel in Explorer, inspect Properties, read scripts, fly through the 3D view, and render a PNG of the current camera.

This build is inspired by [Asicosilomu/studio-lite](https://github.com/Asicosilomu/studio-lite).

## Features

- **Read RBXL and RBXM** (binary) via [rbxBinaryParser](https://github.com/MrSprinkleToes/rbxBinaryParser)
- **Read RBXLX and RBXMX** (XML) — including XML files that still use an `.rbxl` extension
- Explorer + Properties, with click-to-select in the 3D view
- Script viewer for Script / LocalScript / ModuleScript
- Fly camera: click-drag to look, WASD move, Q/E up/down, Shift sprint
- Skybox, selection outlines, axes helper, stats
- Render the viewport to a PNG at any resolution
- Built-in **Lite Plaza** demo so you can try it without a file
- Drag and drop a place file onto the window

## How to use

Studio Lite is fully client-side. Serve the project root with any static HTTP server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

1. Click **Enter Lite Plaza** to explore the bundled demo.
2. Or choose **Open from your computer** and pick a `.rbxl` / `.rbxm` / `.rbxlx` / `.rbxmx` file.
3. Click parts in the viewport or Explorer. Press **F** to zoom to the selection.
4. Click a script in Explorer to read its source.
5. **File → Render image…** to export a PNG.

### Camera

| Input | Action |
| --- | --- |
| Click + drag | Look around |
| W A S D | Move |
| Q / Ctrl | Down |
| E / Space | Up |
| Shift | Sprint |
| Mouse wheel | Change fly speed |
| F | Zoom to selected part |
| Click a part | Select it in Explorer |

## Assets

Decals and file meshes are loaded from the `asset/` folder as `[assetid].png` or `[assetid].mesh`. After opening a place, use **File → Missing assets…** for a list of IDs to download from Roblox AssetDelivery (you must be signed in on roblox.com):

```
https://assetdelivery.roblox.com/v1/asset?id=[assetid]
```

`rbxasset://` paths resolve under `content/`. `rbxgameasset://` paths cannot be resolved (they belong to a published experience).

This repository does **not** ship Roblox Studio icons, official skyboxes, or Roblox template places.

## Acknowledgements

- [Asicosilomu/studio-lite](https://github.com/Asicosilomu/studio-lite) — original Studio Lite
- [rbxBinaryParser](https://github.com/MrSprinkleToes/rbxBinaryParser) by MrSprinkleToes
- [THREE.js](https://threejs.org/) for rendering
- [7.css](https://khang-nd.github.io/7.css/) for the Aero UI

Studio Lite is not affiliated with or endorsed by Roblox Corporation.
