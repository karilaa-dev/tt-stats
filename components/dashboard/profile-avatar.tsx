import { useState } from "react"
import { UserIcon, UsersIcon } from "@phosphor-icons/react"

export function ProfileAvatar({ userId }: { userId: string }) {
  const [failedId, setFailedId] = useState<string | null>(null)
  return (
    <span className="profile-avatar" aria-hidden="true">
      {failedId !== userId ? (
        <img
          src={`/api/users/${encodeURIComponent(userId)}/avatar`}
          alt=""
          width={48}
          height={48}
          onError={() => setFailedId(userId)}
        />
      ) : userId.startsWith("-") ? (
        <UsersIcon />
      ) : (
        <UserIcon />
      )}
    </span>
  )
}
