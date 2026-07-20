export const HOME_FEED_CONFIG = {
  minimumItems: 4,
  sectionLimit: 10,
  candidateLimit: 100,
  recentDays: 30,
  minRealActivity: 20,
  popularityWeights: {
    real: { order: 5, cartAdd: 2, view: 0.5, manual: 0.15 },
    coldStart: { order: 1, cartAdd: 0.5, view: 0.1, manual: 8 },
  },
  coldStartBonuses: { featured: 4, essential: 3, deal: 2 },
} as const;

export type HomeFeedConfig = typeof HOME_FEED_CONFIG;
