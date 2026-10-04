/**
 * Calculate a child command's remaining time within its suite deadline.
 * @param deadline the monotonic deadline for the complete suite
 * @param step the command or phase that needs the remaining time
 * @returns positive whole milliseconds, or throws when the suite budget is exhausted
 */
export function remainingTime(deadline: number, step: string): number {
    const remaining = Math.ceil(deadline - performance.now());
    if (remaining <= 0) throw new Error(`The suite budget is exhausted before ${step}.`);
    return remaining;
}
