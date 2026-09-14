export interface TelegramUser {
  id: string
  name: string
  username: string | null
}
export interface BrowserSession {
  user: TelegramUser | null
  admin: boolean
  loginAvailable: boolean
}
export interface Principal {
  user: TelegramUser | null
  admin: boolean
}
