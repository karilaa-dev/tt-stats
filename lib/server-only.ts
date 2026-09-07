// Fail the browser build if a database or credential module enters an island.
if (typeof window !== "undefined") {
  throw new Error("This module is only available on the server.")
}
export {}
