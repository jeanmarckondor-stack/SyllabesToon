const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const soundsDir = path.join(rootDir, "assets", "audio", "rewards");
const manifestPath = path.join(soundsDir, "sounds.json");

// Regenerate with: node scripts/update-sounds-json.js

function readExistingManifest() {
  if (!fs.existsSync(manifestPath)) {
    return new Map();
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (!Array.isArray(parsed)) {
      return new Map();
    }

    return new Map(
      parsed
        .filter((item) => item && typeof item.file === "string")
        .map((item) => [normalizeSlash(item.file), item]),
    );
  } catch {
    return new Map();
  }
}

function listMp3Files(directory, baseDirectory = directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listMp3Files(fullPath, baseDirectory);
    }

    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".mp3") {
      return [];
    }

    return normalizeSlash(path.relative(baseDirectory, fullPath));
  });
}

function buildManifest() {
  const existingManifest = readExistingManifest();
  return listMp3Files(soundsDir)
    .sort((first, second) => first.localeCompare(second, "fr", { sensitivity: "base" }))
    .map((file) => {
      const existingItem = existingManifest.get(file);
      if (existingItem?.levels) {
        return { file, levels: existingItem.levels };
      }

      return { file };
    });
}

function normalizeSlash(filePath) {
  return filePath.replace(/\\/g, "/");
}

fs.mkdirSync(soundsDir, { recursive: true });
fs.writeFileSync(manifestPath, `${JSON.stringify(buildManifest(), null, 2)}\n`);
console.log(`Updated ${path.relative(rootDir, manifestPath)}`);
