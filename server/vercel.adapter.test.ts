import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveStaticDirectory } from "./_core/static";

const projectRoot = path.resolve(import.meta.dirname, "..");

describe("Vercel deployment adapter", () => {
  it("builds the Vite client into Vercel's public directory", () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
    const vercelConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, "vercel.json"), "utf8"));

    expect(packageJson.scripts["build:vercel"]).toBe("vite build --outDir ../public");
    expect(vercelConfig.buildCommand).toBe("pnpm run build:vercel");
    expect(vercelConfig.outputDirectory).toBe("public");
    expect(vercelConfig.functions["server.ts"].includeFiles).toBe("public/**");
  });

  it("uses the root public directory when deployed on Vercel", () => {
    expect(resolveStaticDirectory(true)).toBe(path.join(projectRoot, "public"));
    expect(resolveStaticDirectory(false)).not.toBe(path.join(projectRoot, "public"));
  });

  it("keeps a root Node server entrypoint that serves the existing Express app", () => {
    const entrypoint = fs.readFileSync(path.join(projectRoot, "server.ts"), "utf8");

    expect(entrypoint).toContain('import { createApp } from "./server/_core/index"');
    expect(entrypoint).toContain("serveStatic(app)");
    expect(entrypoint).toContain("server.listen");
  });
});
