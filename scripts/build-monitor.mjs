import { build, write } from "bun"

export async function buildMonitor(outfile) {
  const result = await build({
    entrypoints: ["server/plugins/video-inactivity-listener.ts"],
    target: "bun",
    format: "esm",
    packages: "external",
  })
  if (!result.success) {
    throw new AggregateError(
      result.logs,
      "Failed to bundle the notification monitor"
    )
  }
  await write(outfile, result.outputs[0])
}
if (process.argv[1]?.endsWith("build-monitor.mjs")) {
  await buildMonitor("dist/monitor.mjs")
}
