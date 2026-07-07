import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import handler from "./dist/server/server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = path.join(__dirname, "dist", "client");
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer(async (req, res) => {
  try {
    const cleanUrl = req.url.split("?")[0].split("#")[0];
    let filePath = path.join(CLIENT_DIR, cleanUrl);

    if (cleanUrl === "/" || cleanUrl === "") {
      filePath = path.join(CLIENT_DIR, "index.html");
    }

    let isStatic = false;
    try {
      const stats = await fs.promises.stat(filePath);
      if (stats.isFile()) {
        isStatic = true;
      }
    } catch {}

    if (isStatic) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // SSR request handler conversion
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const headers = new Headers();
    for (const [key, val] of Object.entries(req.headers)) {
      if (val === undefined) continue;
      if (Array.isArray(val)) {
        val.forEach((v) => headers.append(key, v));
      } else {
        headers.set(key, val);
      }
    }

    let body = null;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks);
    }

    const webRequest = new Request(url, {
      method: req.method,
      headers,
      body,
      duplex: "half",
    });

    const webResponse = await handler.fetch(webRequest);

    res.statusCode = webResponse.status;
    webResponse.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (webResponse.body) {
      const reader = webResponse.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (err) {
    console.error("Server error:", err);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
