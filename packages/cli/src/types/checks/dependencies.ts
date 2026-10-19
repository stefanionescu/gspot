export type PackageFields = {
    packageManager?: string | undefined;
    dependencies?: Record<string, string> | undefined;
    devDependencies?: Record<string, string> | undefined;
    optionalDependencies?: Record<string, string> | undefined;
};
