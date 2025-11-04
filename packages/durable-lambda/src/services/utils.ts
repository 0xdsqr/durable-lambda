export function parseDuration(d: string | number): number {
  if (typeof d === "number") return d
  const m = /^(\d+)(ms|s|m|h|d)?$/.exec(d.trim())
  if (!m) throw new Error(`Bad duration: ${d}`)
  const n = Number(m[1])
  switch (m[2]) {
    case "s":
      return n * 1000
    case "m":
      return n * 60_000
    case "h":
      return n * 3_600_000
    case "d":
      return n * 86_400_000
    default:
      return n
  }
}
