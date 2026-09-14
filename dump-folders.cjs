#!/usr/bin/env node
/**
 * dump-folders.js
 *
 * Usage:
 *   node dump-folders.js --folder src --out dump.txt
 *   node dump-folders.js --folder src --folder lib --out dump.txt
 *
 * Output format:
 *   relative/path
 *   <file contents>
 *
 *   relative/path
 *   <file contents>
 */

const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const args = { folders: [], out: "folder_dump.txt" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--folder") args.folders.push(argv[++i]);
    else if (a === "--out") args.out = argv[++i];
  }
  return args;
}

function isProbablyBinary(buf) {
  // If there's any NUL byte in first 64KB, treat as binary.
  const sample = buf.subarray(0, Math.min(buf.length, 64 * 1024));
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) return true;
  }
  return false;
}

function shouldSkipDirname(name) {
  // quick common skips; remove if you truly want everything
  return (
    name === ".git" ||
    name === "node_modules" ||
    name === "dist" ||
    name === "build" ||
    name === ".next" ||
    name === "coverage" ||
    name === ".turbo" ||
    name === ".cache"
  );
}

function walkDir(dirAbs, filesOut) {
  let entries;
  try {
    entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  } catch {
    return;
  }

  for (const ent of entries) {
    const abs = path.join(dirAbs, ent.name);

    if (ent.isDirectory()) {
      if (shouldSkipDirname(ent.name)) continue;
      walkDir(abs, filesOut);
      continue;
    }

    if (!ent.isFile()) continue;

    filesOut.push(abs);
  }
}

function stableSortPaths(pathsArr) {
  return pathsArr.sort((a, b) => a.localeCompare(b));
}

function main() {
  const cwd = process.cwd();
  const args = parseArgs(process.argv);

  if (!args.folders.length) {
    console.error("Missing required arg: --folder <path> (can be provided multiple times)");
    process.exit(1);
  }

  const folderAbsList = args.folders.map((f) => path.resolve(cwd, f));
  for (const fAbs of folderAbsList) {
    if (!fs.existsSync(fAbs) || !fs.statSync(fAbs).isDirectory()) {
      console.error(`Folder not found or not a directory: ${fAbs}`);
      process.exit(1);
    }
  }

  const allFiles = [];
  for (const folderAbs of folderAbsList) {
    walkDir(folderAbs, allFiles);
  }

  // de-dupe (in case overlapping folders)
  const uniqueFiles = [...new Set(allFiles)];
  stableSortPaths(uniqueFiles);

  const chunks = [];
  for (const abs of uniqueFiles) {
    let buf;
    try {
      buf = fs.readFileSync(abs);
    } catch {
      continue;
    }
    if (isProbablyBinary(buf)) continue;

    const rel = path.relative(cwd, abs);
    const code = buf.toString("utf8").replace(/\r\n/g, "\n");

    chunks.push(rel);
    chunks.push(code);
    chunks.push(""); // blank line
    chunks.push(""); // extra blank line between files
  }

  const outAbs = path.resolve(cwd, args.out);
  fs.writeFileSync(outAbs, chunks.join("\n"), "utf8");

  console.log(`Wrote ${uniqueFiles.length} file paths (text-only included) to ${path.relative(cwd, outAbs)}`);
}

if (require.main === module) {
  main();
}
