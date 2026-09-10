import * as stats from "./stats"
import * as telegram from "./telegram"
import * as notifications from "./notifications"

export const server = { ...stats, ...telegram, ...notifications }
