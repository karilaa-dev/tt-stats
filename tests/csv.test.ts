import { describe, expect, it } from "vitest"

import { historyCsv, utcIsoFromEpoch } from "@/lib/csv/format"

describe("history CSV", () => {
  it("escapes links and formats UTC timestamps", () => {
    expect(utcIsoFromEpoch(0)).toBe("1970-01-01T00:00:00.000Z")
    expect(
      historyCsv([
        { Time: utcIsoFromEpoch(0), Video: 'https://example.test/a,"b"' },
      ])
    ).toBe(
      'Time,Video\n1970-01-01T00:00:00.000Z,"https://example.test/a,""b"""\n'
    )
  })
})
