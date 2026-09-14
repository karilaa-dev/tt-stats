// Only read operations participate. Administrative mutations keep their own
// confirmation and job controls; cancelling a read cannot undo a mutation.
export const databaseReads = {
  getSnapshotMetadata: "Checking statistics",
  getOverview: "Loading overview",
  getStatsBreakdown: "Loading statistics",
  getTimeSeries: "Loading activity",
  getReferralStats: "Loading referrals",
  getOtherStats: "Loading statistics",
  getMyStats: "Loading your profile",
  getUserStats: "Loading profile",
  getMyDownloads: "Loading download history",
  getUserDownloads: "Loading download history",
  getMyActivity: "Loading download activity",
  getUserActivity: "Loading download activity",
  getPopularVideos: "Loading top videos",
  getDownloaders: "Loading downloaders",
  getStatsJobs: "Loading database jobs",
  getStatsJobRuns: "Loading job history",
  getDatabaseSetupStatus: "Checking database setup",
} as const

export interface TaskProgress {
  phase: string
  completed: number | null
  total: number | null
  elapsedMs: number
  remainingMs: number | null
  state: "running" | "done" | "cancelled"
}
