import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/formatter.ts",
    "src/transports/index.ts",
    "src/transports/*.ts",
    "src/transports/node/index.ts",
    "src/transports/node/*.ts",
  ],
  format: ["esm", "cjs"],
  dts: true,
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
});
