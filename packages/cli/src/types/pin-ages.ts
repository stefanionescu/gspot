export type MiseVersion = { version: string; created_at?: string | undefined };

export type NpmPackageTimes = { time: Record<string, string> };

export type PypiReleaseFiles = { urls: { upload_time_iso_8601: string }[] };
