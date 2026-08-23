import fs from "node:fs";
import path from "node:path";
import type { Express } from "express";
import express from "express";

export function resolveStaticDirectory(isVercel = Boolean(process.env.VERCEL)) {
  if (isVercel) {
    return path.resolve(process.cwd(), "public");
  }

  return process.env.NODE_ENV === "development"
    ? path.resolve(import.meta.dirname, "../..", "dist", "public")
    : path.resolve(import.meta.dirname, "public");
}

export function serveStatic(app: Express) {
  const distPath = resolveStaticDirectory();
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
