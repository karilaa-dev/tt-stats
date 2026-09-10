import * as stats from "./stats"
import * as telegram from "./telegram"
import * as notifications from "./notifications"

import * as media from "./media"

export const server = { ...stats, ...telegram, ...notifications, ...media }
