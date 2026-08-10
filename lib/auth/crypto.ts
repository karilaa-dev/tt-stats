import { createHash, createHmac, timingSafeEqual } from "node:crypto"

export function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest()
}

export function constantTimeEqual(left: string, right: string): boolean {
  return timingSafeEqual(sha256(left), sha256(right))
}

export function credentialVersion(
  secret: string,
  username: string,
  password: string
): string {
  return createHmac("sha256", secret)
    .update(username, "utf8")
    .update("\0", "utf8")
    .update(password, "utf8")
    .digest("base64url")
}

export function usernameSubject(username: string): string {
  return sha256(username).toString("base64url")
}
