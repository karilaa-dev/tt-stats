import { useCallback, useState } from "react"
import { UserIcon, UsersIcon } from "@phosphor-icons/react"

export function ProfileAvatar({ userId }: { userId: string }) {
  const [failedId, setFailedId] = useState<string | null>(null)
  // A server-rendered image can fail before hydration attaches onError, so a
  // finished image without pixels counts as a failure too.
  const checkLoaded = useCallback(
    (image: HTMLImageElement | null) => {
      if (image?.complete && image.naturalWidth === 0) setFailedId(userId)
    },
    [userId]
  )
  return (
    <span className="profile-avatar" aria-hidden="true">
      {failedId !== userId ? (
        <img
          ref={checkLoaded}
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
