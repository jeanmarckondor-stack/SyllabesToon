const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");

const host = "localhost";
const port = 8000;
const rootDir = path.resolve(__dirname, "..");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function updateManifest(label, scriptPath, successMessage) {
  try {
    require(scriptPath);
    console.log(successMessage);
  } catch (error) {
    console.error(`Mise a jour ${label} impossible: ${error.message}`);
  }
}

function getContentType(filePath) {
  return contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function resolveRequestPath(requestUrl) {
  const parsedUrl = new URL(requestUrl, `http://${host}:${port}`);
  const decodedPath = decodeURIComponent(parsedUrl.pathname);
  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const filePath = path.resolve(rootDir, relativePath);

  if (!filePath.startsWith(rootDir + path.sep) && filePath !== rootDir) {
    return null;
  }

  return filePath;
}

function sendNotFound(response) {
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Fichier introuvable");
}

function sendMethodNotAllowed(response) {
  response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Methode non autorisee");
}

function sendFile(request, response, filePath, stats) {
  const contentType = getContentType(filePath);
  const range = request.headers.range;

  if (range) {
    const match = range.match(/^bytes=(\d*)-(\d*)$/);
    if (!match) {
      response.writeHead(416, { "Content-Range": `bytes */${stats.size}` });
      response.end();
      return;
    }

    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : stats.size - 1;
    if (start >= stats.size || end >= stats.size || start > end) {
      response.writeHead(416, { "Content-Range": `bytes */${stats.size}` });
      response.end();
      return;
    }

    response.writeHead(206, {
      "Content-Type": contentType,
      "Content-Length": end - start + 1,
      "Content-Range": `bytes ${start}-${end}/${stats.size}`,
      "Accept-Ranges": "bytes",
    });
    fs.createReadStream(filePath, { start, end }).pipe(response);
    return;
  }

  response.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": stats.size,
    "Accept-Ranges": "bytes",
  });
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer((request, response) => {
  if (!["GET", "HEAD"].includes(request.method)) {
    sendMethodNotAllowed(response);
    return;
  }

  const filePath = resolveRequestPath(request.url);
  if (!filePath) {
    sendNotFound(response);
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      sendNotFound(response);
      return;
    }

    if (request.method === "HEAD") {
      response.writeHead(200, {
        "Content-Type": getContentType(filePath),
        "Content-Length": stats.size,
        "Accept-Ranges": "bytes",
      });
      response.end();
      return;
    }

    sendFile(request, response, filePath, stats);
  });
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Le port ${port} est deja utilise. Arrete le serveur en cours puis relance cette commande.`);
  } else {
    console.error("Erreur serveur:", error.message);
  }
  process.exit(1);
});

updateManifest("videos.json", path.join(__dirname, "update-videos-json.js"), "mise a jour videos.json OK");
updateManifest("sounds.json", path.join(__dirname, "update-sounds-json.js"), "mise a jour sounds.json OK");

server.listen(port, host, () => {
  console.log("SyllabesToon lance");
  console.log(`http://${host}:${port}/index.html`);
  console.log(`http://${host}:${port}/teacher-manager.html`);
});
