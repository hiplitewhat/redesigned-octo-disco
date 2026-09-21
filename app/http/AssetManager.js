import { tryToFetch_status } from "./TryToFetch.js?v=5";

export default class AssetManager {
  constructor(conf) {
    this.conf = conf;
    this.parseCache = {};
    this.failedAssets = [];
    this.texturesOfFailedMeshes = {};
    this.missingAssets = "You haven't opened a Place yet. Open a Place to get insights on missing assets.";
    this.hasRbxGameAsset = false;
  }

  getAssetId(path) {
    if (!path || typeof path !== "string") return false;
    const scheme = path.split("://")[0];
    if (scheme === "rbxassetid") return path.split("://").pop().trim();
    if (scheme === "http" || scheme === "https") {
      try {
        const url = new URL(path);
        const id = url.searchParams.get("id");
        if (id) return id.trim();
      } catch {
        /* fall through */
      }
      if (path.includes("=")) return path.split("=").pop().trim();
    }
    if (!this.hasRbxGameAsset && scheme === "rbxgameasset") this.hasRbxGameAsset = true;
    return false;
  }

  pushFailedMesh(assetId, meshTexture) {
    if (!assetId) return;
    if (!this.texturesOfFailedMeshes[assetId]) this.texturesOfFailedMeshes[assetId] = [];
    if (this.texturesOfFailedMeshes[assetId].indexOf(meshTexture) === -1) {
      this.texturesOfFailedMeshes[assetId].push(meshTexture);
    }
  }

  async parseAssetPath(path, type = "decal", meshTexture = "N/A") {
    if (meshTexture === false) meshTexture = "N/A";
    if (path == null) path = "";
    const assetId = this.getAssetId(path);
    if (type === "mesh" && this.parseCache[path] && this.parseCache[path].length === 0) {
      this.pushFailedMesh(assetId, meshTexture);
    }
    if (this.parseCache[path] !== undefined) return this.parseCache[path];

    let href = "";
    if (typeof path === "string" && path.split("://")[0] === "rbxasset") {
      href = "content/" + path.split("://").pop();
    }
    if (assetId) href = "asset/" + assetId.trim() + (type === "decal" ? ".png" : ".mesh");
    if (assetId !== false && this.failedAssets.indexOf(assetId) !== -1) {
      this.parseCache[path] = "";
      return "";
    }

    if (!href.trim()) {
      if (path.trim() && path.split("://")[0] !== "rbxgameasset") {
        this.conf.sharedFunctions.print(
          `Asset path ${path} could not be resolved! This might be a deficiency in Studio Lite.`
        );
      }
      this.parseCache[path] = "";
      return "";
    }

    const fetchResult = await tryToFetch_status(href);
    if (fetchResult === 200) {
      this.parseCache[path] = href;
      return href;
    }
    if (fetchResult === 404 && assetId !== false && this.failedAssets.indexOf(assetId) === -1) {
      this.failedAssets.push(assetId);
    }
    if (type === "mesh" && fetchResult === 404 && assetId !== false) {
      this.pushFailedMesh(assetId, meshTexture);
    }
    this.parseCache[path] = "";
    return "";
  }

  computeMissingAssetsList() {
    if (this.failedAssets.length > 0) {
      this.missingAssets = `Below are listed all the assets in this Place that have failed to load, likely because they aren't saved on the server.
To fix this, download the missing assets using the AssetDelivery API and place them in the asset/ directory.
The name must be given as [assetid].[extension], where the extension is:
.png for image assets
.mesh for meshes

AssetID listing starts here:`;
      for (const asset of this.failedAssets) {
        const textures = this.texturesOfFailedMeshes[asset];
        this.missingAssets += `\n${textures ? "Mesh" : "Decal"} ${String(asset).trim()}${
          textures ? `, texture ${textures.join(", ")}` : ""
        }`;
      }
      return true;
    }
    this.missingAssets = "All assets in this Place have loaded successfully.";
    return false;
  }

  reset() {
    this.parseCache = {};
    this.failedAssets = [];
    this.texturesOfFailedMeshes = {};
    this.hasRbxGameAsset = false;
    this.missingAssets = "You haven't opened a Place yet. Open a Place to get insights on missing assets.";
  }
}
