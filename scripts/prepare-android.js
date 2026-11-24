const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const webDir = path.join(dist, "android-web");
const catalogs = new Set([
  "assets/audio/rewards/sounds.json",
  "assets/videos/videos.json",
]);
const assetExtensions = new Set([
  ".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif", ".ico",
  ".mp3", ".wav", ".ogg", ".webm", ".mp4", ".woff", ".woff2", ".ttf", ".otf",
]);

function copyTree(directory, includeFile) {
  for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name.startsWith("__obsolete_")) {
      continue;
    }

    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      copyTree(relative, includeFile);
    } else if (entry.isFile() && includeFile(relative)) {
      const destination = path.join(webDir, relative);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(path.join(root, relative), destination);
    }
  }
}

fs.mkdirSync(dist, { recursive: true });
if (fs.lstatSync(dist).isSymbolicLink() || (fs.existsSync(webDir) && fs.lstatSync(webDir).isSymbolicLink())) {
  throw new Error("Le dossier de preparation Android ne peut pas etre un lien symbolique.");
}
fs.rmSync(webDir, { recursive: true, force: true });
fs.mkdirSync(webDir);

for (const page of ["index.html", "teacher-manager.html"]) {
  fs.copyFileSync(path.join(root, page), path.join(webDir, page));
}

// Add the WebView layout to the generated game page only.
const gamePage = path.join(webDir, "index.html");
const gameHtml = fs.readFileSync(gamePage, "utf8");
if (!gameHtml.includes("</head>")) {
  throw new Error("Balise </head> introuvable dans index.html.");
}
fs.writeFileSync(gamePage, gameHtml.replace("</head>", '<link rel="stylesheet" href="src/game-android.css">\n  </head>'));

copyTree("src", (file) => /\.(css|js)$/i.test(file));
copyTree("assets", (file) => catalogs.has(file) || assetExtensions.has(path.extname(file).toLowerCase()));

console.log("Sources web Android preparees dans dist/android-web.");
