import { build } from "esbuild"

export async function buildMonitor(outfile) {
  await build({
    entryPoints: ["server/plugins/video-inactivity-listener.ts"],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    packages: "external",
  })
}
if (process.argv[1]?.endsWith("build-monitor.mjs")) {
  await buildMonitor("dist/monitor.mjs")
}
