/** A literal Next.js configuration option that disables a check or exposes a likely secret. */
export type NextSettingsFinding = { name: string; line: number; kind: 'checks-off' | 'env-secret' };
