// The types of checks/nginx in this package.

export type DirectiveScan = { token: string | undefined; end: number };

/** One repository configuration copied for a container mount. */
export type MountedConfiguration = { path: string; source: string; target: string; text: string };
