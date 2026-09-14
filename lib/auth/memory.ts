import "@/lib/server-only"

// No background timer or disk persistence. Expired entries are collected on use.
export class MemoryStore<T> {
  private entries = new Map<string, { value: T; expires: number }>()
  constructor(
    private capacity: number,
    private now = Date.now
  ) {}
  get(key: string): T | undefined {
    const entry = this.entries.get(key)
    if (!entry) return
    if (entry.expires <= this.now()) {
      this.entries.delete(key)
      return
    }
    return entry.value
  }
  take(key: string) {
    const value = this.get(key)
    this.entries.delete(key)
    return value
  }
  delete(key: string) {
    this.entries.delete(key)
  }
  set(key: string, value: T, ttl: number) {
    if (this.entries.size >= this.capacity) {
      for (const [id, entry] of this.entries)
        if (entry.expires <= this.now()) this.entries.delete(id)
    }
    if (!this.entries.has(key) && this.entries.size >= this.capacity)
      throw new Error("Session capacity reached")
    this.entries.set(key, { value, expires: this.now() + ttl })
  }
}
