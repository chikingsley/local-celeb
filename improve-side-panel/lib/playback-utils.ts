import { parseTime as utilParseTime } from "./utils"

export function parseTime(timeStr: string): number {
  return utilParseTime(timeStr)
}
