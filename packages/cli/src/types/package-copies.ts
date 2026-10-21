export type InstalledPackage = PackageIdentity & { entry: string };
export type PackageIdentity = { name: string; version: string; peerDependencies: Record<string, string> };
export type StylelintModule = {
    resolveConfig: (file: string, options: { config: { extends: string } }) => Promise<unknown>;
};
export type PrettierModule = {
    format: (text: string, options: Record<string, unknown>) => Promise<string>;
    resolveConfig: (path: string) => Promise<Record<string, unknown> | null>;
};
export type StylelintSettings = { rules: Record<string, unknown> };
export type EslintRuleModule = { builtinRules: Map<string, unknown> };
export type PackageModule = { default: unknown };
export type GlobalsModule = { default: Record<string, Record<string, boolean>> };

export type StylelintModuleExport = { default: StylelintModule };
export type PackageCopyTests = { devDependencies: Record<string, string> };
