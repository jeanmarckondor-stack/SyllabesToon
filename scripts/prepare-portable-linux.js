const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const rootDir = path.resolve(__dirname, "..");
const portableDir = path.join(rootDir, "portable-linux");
const serverPath = path.join(portableDir, "server");
const filesToCopy = ["index.html", "teacher-manager.html"];
const directoriesToCopy = ["src", "assets"];

function fileHash(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function checkWebPath(baseDir, relativePath) {
  if (typeof relativePath !== "string" || relativePath.includes("\\")) {
    throw new Error(`Separateurs incompatibles Linux: ${relativePath}`);
  }

  const parts = relativePath.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) {
    throw new Error(`Chemin de media invalide: ${relativePath}`);
  }

  let current = baseDir;
  for (const part of parts) {
    if (!fs.readdirSync(current).includes(part)) {
      throw new Error(`Fichier absent ou casse incorrecte: ${relativePath}`);
    }
    current = path.join(current, part);
  }
  if (!fs.statSync(current).isFile()) {
    throw new Error(`Media invalide: ${relativePath}`);
  }
}

function validateManifest(relativeDir, filename) {
  const mediaDir = path.join(portableDir, relativeDir);
  const manifest = JSON.parse(fs.readFileSync(path.join(mediaDir, filename), "utf8"));
  if (!Array.isArray(manifest)) {
    throw new Error(`Manifest invalide: ${filename}`);
  }
  for (const entry of manifest) {
    checkWebPath(mediaDir, entry.file);
  }
  console.log(`${filename}: ${manifest.length} medias, chemins Linux OK`);
}

function countFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).reduce((total, entry) => {
    return total + (entry.isDirectory() ? countFiles(path.join(directory, entry.name)) : 1);
  }, 0);
}

function preparePortableLinux() {
  if (fs.lstatSync(portableDir).isSymbolicLink()) {
    throw new Error("portable-linux doit etre un dossier reel, pas un lien.");
  }
  const serverHash = fileHash(serverPath);
  for (const relativePath of [...filesToCopy, ...directoriesToCopy]) {
    const info = fs.statSync(path.join(rootDir, relativePath));
    if (filesToCopy.includes(relativePath) ? !info.isFile() : !info.isDirectory()) {
      throw new Error(`Source invalide: ${relativePath}`);
    }
  }

  require(path.join(__dirname, "update-videos-json.js"));
  require(path.join(__dirname, "update-sounds-json.js"));

  for (const file of filesToCopy) {
    fs.copyFileSync(path.join(rootDir, file), path.join(portableDir, file));
  }
  for (const directory of directoriesToCopy) {
    const target = path.resolve(portableDir, directory);
    // Only these generated subdirectories may be replaced; never remove portable-linux itself.
    if (path.dirname(target) !== portableDir || !directoriesToCopy.includes(path.basename(target))) {
      throw new Error(`Destination de copie interdite: ${target}`);
    }
    if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) {
      throw new Error(`Destination liee interdite: ${target}`);
    }
    fs.rmSync(target, { recursive: true, force: true });
    fs.cpSync(path.join(rootDir, directory), target, { recursive: true });
  }

  validateManifest("assets/videos", "videos.json");
  validateManifest("assets/audio/rewards", "sounds.json");
  if (fileHash(serverPath) !== serverHash) {
    throw new Error("Le binaire server a change pendant la preparation.");
  }

  console.log(`Fichiers copies: ${filesToCopy.length + directoriesToCopy.reduce((total, dir) => total + countFiles(path.join(portableDir, dir)), 0)}`);
  console.log("server conserve (SHA-256 identique)");
  console.log("portable-linux pret, sans import de donnees enseignante");
}

try {
  preparePortableLinux();
} catch (error) {
  console.error(`Preparation Linux impossible: ${error.message}`);
  process.exitCode = 1;
}
