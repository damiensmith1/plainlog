#!/usr/bin/env node
/**
 * dump-deps.js
 *
 * Usage:
 *   node dump-deps.js --entry src/index.ts --out deps_dump.txt
 *
 * Notes:
 * - Traverses local files + node_modules via Node resolution.
 * - Includes huge files.
 * - Skips obvious binaries (best-effort).
 */

const fs = require("fs");
const path = require("path");
const Module = require("module");

function parseArgs(argv) {
  const args = { entry: null, out: "deps_dump.txt" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--entry") args.entry = argv[++i];
    else if (a === "--out") args.out = argv[++i];
  }
  return args;
}

function isProbablyBinary(buf) {
  // Heuristic: if there are any NUL bytes in the first chunk, treat as binary.
  const sample = buf.subarray(0, Math.min(buf.length, 64 * 1024));
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) return true;
  }
  return false;
}

// Lightweight extraction of module specifiers (not a full JS parser).
function extractSpecifiers(code) {
  const specs = new Set();

  // import ... from 'x'
  const importFromRe = /import\s+[^;]*?\s+from\s+['"]([^'"]+)['"]/g;
  // import 'x'
  const importBareRe = /import\s+['"]([^'"]+)['"]/g;
  // require('x')
  const requireRe = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  // import('x')
  const dynImportRe = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (const re of [importFromRe, importBareRe, requireRe, dynImportRe]) {
    let m;
    while ((m = re.exec(code))) specs.add(m[1]);
  }

  return [...specs];
}

function resolveLikeNode(spec, fromFile, cwd) {
  // Ignore built-ins (fs, path, node:fs, etc.)
  if (spec.startsWith("node:")) return null;
  if (Module.builtinModules.includes(spec)) return null;

  // Use Node's resolver first (handles node_modules, exports, etc.)
  try {
    return Module._resolveFilename(spec, {
      id: fromFile,
      filename: fromFile,
      paths: Module._nodeModulePaths(path.dirname(fromFile)),
    });
  } catch {
    // For relative imports missing extension, try common extensions / index files
    if (spec.startsWith(".") || spec.startsWith("/")) {
      const base = spec.startsWith("/")
        ? path.resolve(cwd, "." + spec)
        : path.resolve(path.dirname(fromFile), spec);

      const tries = [
        base,
        base + ".ts",
        base + ".tsx",
        base + ".js",
        base + ".jsx",
        base + ".mjs",
        base + ".cjs",
        base + ".json",
        path.join(base, "index.ts"),
        path.join(base, "index.tsx"),
        path.join(base, "index.js"),
        path.join(base, "index.jsx"),
        path.join(base, "index.mjs"),
        path.join(base, "index.cjs"),
        path.join(base, "index.json"),
      ];

      for (const t of tries) {
        try {
          if (fs.statSync(t).isFile()) return t;
        } catch {}
      }
    }

    return null;
  }
}

function readTextFile(absPath) {
  const buf = fs.readFileSync(absPath);
  if (isProbablyBinary(buf)) return null;
  return buf.toString("utf8");
}

function dumpDeps({ entryAbs, outAbs, cwd }) {
  const visited = new Set(); // abs paths
  const order = []; // preserve discovery order
  const queue = [entryAbs];

  while (queue.length) {
    const file = queue.shift();
    if (!file) continue;

    // Some resolutions can return non-paths; ignore.
    if (file.startsWith("node:")) continue;

    const abs = path.isAbsolute(file) ? file : path.resolve(cwd, file);
    if (visited.has(abs)) continue;

    let stat;
    try {
      stat = fs.statSync(abs);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;

    const code = readTextFile(abs);
    if (code == null) continue; // binary-ish

    visited.add(abs);
    order.push(abs);

    const specs = extractSpecifiers(code);
    for (const spec of specs) {
      const resolved = resolveLikeNode(spec, abs, cwd);
      if (!resolved) continue;
      if (!visited.has(resolved)) queue.push(resolved);
    }
  }

  const chunks = [];
  for (const abs of order) {
    const rel = path.relative(cwd, abs);
    const code = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n");
    chunks.push(rel);
    chunks.push(code);
    chunks.push(""); // blank line
    chunks.push(""); // extra blank line between files
  }

  fs.writeFileSync(outAbs, chunks.join("\n"), "utf8");
  return { fileCount: order.length };
}

function main() {
  const cwd = process.cwd();
  const args = parseArgs(process.argv);

  if (!args.entry) {
    console.error("Missing required arg: --entry <path>");
    process.exit(1);
  }

  const entryAbs = path.resolve(cwd, args.entry);
  if (!fs.existsSync(entryAbs)) {
    console.error(`Entry file not found: ${args.entry}`);
    process.exit(1);
  }

  const outAbs = path.resolve(cwd, args.out);

  const { fileCount } = dumpDeps({ entryAbs, outAbs, cwd });

  console.log(`Wrote ${fileCount} files to ${path.relative(cwd, outAbs)}`);
}

if (require.main === module) {
  main();
}
