import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveStaticDirectory } from "./_core/static";

const projectRoot = path.resolve(import.meta.dirname, "..");

describe("Vercel deployment adapter", () => {
  it("builds the Vite client into Vercel's public directory", () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
    const vercelConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, "vercel.json"), "utf8"));

    expect(packageJson.scripts["build:vercel"]).toContain("vite build --outDir ../public");
    expect(packageJson.scripts["build:vercel"]).toContain("esbuild server/_core/index.ts");
    expect(vercelConfig.buildCommand).toBe("pnpm run build:vercel");
    expect(vercelConfig.outputDirectory).toBe("public");
    expect(vercelConfig.functions["api/index.js"].includeFiles).toBe("public/**");
  });

  it("uses the root public directory when deployed on Vercel", () => {
    expect(resolveStaticDirectory(true)).toBe(path.join(projectRoot, "public"));
    expect(resolveStaticDirectory(false)).not.toBe(path.join(projectRoot, "public"));
  });

  it("keeps a Vercel-recognized api function that serves the existing Express app", () => {
    const entrypoint = fs.readFileSync(path.join(projectRoot, "api", "index.js"), "utf8");

    expect(entrypoint).toContain('import app from "../dist/index.js"');
    expect(entrypoint).toContain("export default app");
  });
});
