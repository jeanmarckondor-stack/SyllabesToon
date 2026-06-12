const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const portableDir = path.join(rootDir, "portable");

const filesToCopy = ["index.html", "teacher-manager.html"];
const directoriesToCopy = ["src", "assets"];

function runManifestUpdate(scriptName, label) {
  try {
    require(path.join(__dirname, scriptName));
    console.log(`${label} regenere`);
  } catch (error) {
    console.error(`${label} non regenere: ${error.message}`);
  }
}

function removeIfExists(targetPath) {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

function copyFile(relativePath) {
  const sourcePath = path.join(rootDir, relativePath);
  const targetPath = path.join(portableDir, relativePath);

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
  return 1;
}

function copyDirectory(relativePath) {
  const sourcePath = path.join(rootDir, relativePath);
  const targetPath = path.join(portableDir, relativePath);

  removeIfExists(targetPath);
  fs.cpSync(sourcePath, targetPath, { recursive: true });
  return countFiles(targetPath);
}

function countFiles(directory) {
  if (!fs.existsSync(directory)) {
    return 0;
  }

  return fs.readdirSync(directory, { withFileTypes: true }).reduce((total, entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return total + countFiles(entryPath);
    }
    return entry.isFile() ? total + 1 : total;
  }, 0);
}

function preparePortable() {
  fs.mkdirSync(portableDir, { recursive: true });

  runManifestUpdate("update-videos-json.js", "videos.json");
  runManifestUpdate("update-sounds-json.js", "sounds.json");

  let copiedFiles = 0;
  for (const file of filesToCopy) {
    copiedFiles += copyFile(file);
  }

  for (const directory of directoriesToCopy) {
    copiedFiles += copyDirectory(directory);
  }

  console.log(`Fichiers copies: ${copiedFiles}`);
  console.log("portable pret");

  if (!fs.existsSync(path.join(portableDir, "server.exe"))) {
    console.log("Rappel: compile server.exe avec go build -o portable/server.exe ./tools/server");
  }
}

preparePortable();
