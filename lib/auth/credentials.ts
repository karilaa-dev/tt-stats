import "server-only"

import type { AuthEnv } from "@/lib/env"
import { constantTimeEqual } from "@/lib/auth/crypto"

export function credentialsMatch(
  username: string,
  password: string,
  env: AuthEnv
): boolean {
  const usernameMatches = constantTimeEqual(username, env.STATS_USERNAME)
  const passwordMatches = constantTimeEqual(password, env.STATS_PASSWORD)
  return usernameMatches && passwordMatches
}
