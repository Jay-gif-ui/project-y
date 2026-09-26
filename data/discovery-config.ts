// Rolling UTC calendar days; all discovery windows and request budgets live here.
export const DISCOVERY_CONFIG = {
  recentDays: 14,
  upcomingDays: 7,
  cacheSeconds: 1800,
  releasePagesPerSource: 1,
  releaseDetailsPerType: 20,
  indiaGlobalProbesPerType: 10,
  indiaManualLimit: 10,
  pageSize: 24,
  globalHomeLimit: 10,
} as const;
