// Ambient declarations for packages that ship none.

declare module '@npmcli/package-json' {
    class PackageJson {
        static load(path: string, options?: { create?: boolean }): Promise<PackageJson>;

        static create(path: string): Promise<PackageJson>;

        readonly content: Record<string, unknown>;

        update(content: Record<string, unknown>): PackageJson;

        save(): Promise<void>;
    }
    export default PackageJson;
}
