// The types of integration/cli/lifecycle/lifecycle in this package.

export type PreCommitConfiguration = { repos?: { hooks: { id: string }[] }[]; fail_fast?: boolean };
export type PackageManifest = { scripts: Record<string, string>; 'simple-git-hooks': Record<string, string> };
export type ResolvedRules = { rules: Record<string, [number, ...unknown[]]> };
