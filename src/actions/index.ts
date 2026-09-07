import * as stats from "./stats"
import * as botstat from "./botstat"
import * as notifications from "./notifications"

export const server = { ...stats, ...botstat, ...notifications }
