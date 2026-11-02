import * as stats from "./stats"
import * as telegram from "./telegram"
import * as notifications from "./notifications"

import * as media from "./media"

import * as scraper from "./scraper"

export const server = {
  ...scraper,
  ...stats,
  ...telegram,
  ...notifications,
  ...media,
}
