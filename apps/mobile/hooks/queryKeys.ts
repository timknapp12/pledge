// Query keys for React Query cache management
// Separated to avoid circular dependencies with AuthContext

export const queryKeys = {
  pledges: (walletAddress: string) => ['pledges', walletAddress] as const,
  pledge: (pledgeId: string) => ['pledge', pledgeId] as const,
  dailyProgress: (pledgeId: string, date?: string) =>
    ['dailyProgress', pledgeId, date] as const,
  templates: (walletAddress: string) => ['templates', walletAddress] as const,
};
