import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { telegramChatQueryOptions } from "@/lib/telegram/query-options"
import type { TelegramChatProfile } from "@/lib/telegram/types"

const chatTypes = {
  private: "Private chat",
  group: "Group",
  supergroup: "Supergroup",
  channel: "Channel",
}

export function TelegramChatCard({ chatId }: { chatId: string }) {
  const query = useQuery(telegramChatQueryOptions(chatId))
  const data: TelegramChatProfile | undefined = query.data
  const profile = data?.status === "available" ? data : null
  const message =
    query.data?.status === "not_configured"
      ? "Configure BOT_TOKEN on the server to load chat names and usernames."
      : query.data?.status === "inaccessible"
        ? "Telegram could not find this chat or the bot cannot access it."
        : "Telegram details are temporarily unavailable."

  return (
    <Card aria-label="Telegram chat details" aria-busy={query.isPending}>
      <CardHeader>
        <CardTitle>{profile?.name ?? "Telegram chat"}</CardTitle>
        <CardDescription>
          <span className="font-mono break-all">{chatId}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3" aria-live="polite">
        {query.isPending ? (
          <Skeleton
            className="h-6 w-48"
            aria-label="Loading Telegram details"
          />
        ) : profile ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{chatTypes[profile.type]}</Badge>
              {profile.demo ? <Badge variant="outline">Demo data</Badge> : null}
            </div>
            {profile.username ? (
              profile.demo ? (
                <p>@{profile.username}</p>
              ) : (
                <a
                  href={`https://t.me/${profile.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-fit break-all underline underline-offset-4"
                >
                  @{profile.username}
                </a>
              )
            ) : (
              <p className="text-sm text-muted-foreground">
                No public username
              </p>
            )}
            {!profile.name ? (
              <p className="text-sm text-muted-foreground">Name unavailable</p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}
      </CardContent>
    </Card>
  )
}
