/** A literal Next.js configuration option that disables a check or exposes a likely secret. */
export type NextSettingsProblem = { name: string; line: number; kind: 'checks-off' | 'env-secret' };
