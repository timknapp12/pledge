/**
 * Returns the display increment for animated amount counting based on total value.
 * Used so large amounts animate in sensible steps (cents for <$3, dollars for <$100, etc.)
 */
function getIncrementForAmount(totalUsd: number): number {
  if (totalUsd < 3) return 0.01;
  if (totalUsd < 100) return 1;
  if (totalUsd < 1_000) return 10;
  if (totalUsd < 10_000) return 100;
  if (totalUsd < 100_000) return 1_000;
  return 10_000;
}

/**
 * Given animation progress (0-100) and total amount in lamports (USDC 6 decimals),
 * returns the lamports value to display, stepped by appropriate increments.
 * Use with formatUsdcAmount() for display.
 */
export function getAnimatedDisplayLamports(
  progress: number,
  totalLamports: number
): number {
  if (totalLamports <= 0) return 0;
  const totalUsd = totalLamports / 1_000_000;
  const increment = getIncrementForAmount(totalUsd);
  const idealUsd = totalUsd * (Math.min(100, Math.max(0, progress)) / 100);
  const steppedUsd = Math.round(idealUsd / increment) * increment;
  const clampedUsd = Math.min(totalUsd, steppedUsd);
  return Math.round(clampedUsd * 1_000_000);
}
