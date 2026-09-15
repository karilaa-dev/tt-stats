import { build, write, file } from "bun"

export async function buildMonitor(outfile) {
  const result = await build({
    entrypoints: ["server/runtime.ts"],
    target: "bun",
    format: "esm",
    packages: "external",
    plugins: [
      {
        name: "sql-text",
        setup(builder) {
          builder.onLoad({ filter: /\.sql\?raw$/ }, async ({ path }) => ({
            contents: await file(path.replace(/\?raw$/, "")).text(),
            loader: "text",
          }))
        },
      },
    ],
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
