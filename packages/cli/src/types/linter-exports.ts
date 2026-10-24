export type InstalledPackage = PackageIdentity & { modulePath: string };
export type PackageIdentity = { name: string; version: string; peerDependencies: Record<string, string> };
export type StylelintModule = {
    resolveConfig: (
        file: string,
        options: { config: { extends: string } },
    ) => Promise<{ rules: Record<string, unknown> }>;
};
export type PrettierModule = {
    format: (text: string, options: Record<string, unknown>) => Promise<string>;
    resolveConfig: (path: string) => Promise<Record<string, unknown> | null>;
};
export type EslintRuleModule = { builtinRules: Map<string, unknown> };
export type GlobalsModule = { default: Record<string, Record<string, boolean>> };

export type TestsManifest = { devDependencies: Record<string, string> };
