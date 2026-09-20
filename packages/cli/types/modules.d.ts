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

// The Emscripten factory inside the libpg-query package, which ships no types for it.
declare module 'libpg-query/wasm/libpg-query.js' {
    const createModule: (options: { wasmBinary: Uint8Array }) => Promise<unknown>;
    export default createModule;
}

declare module 'spdx-expression-parse' {
    export default function parse(expression: string): unknown;
}

declare module 'spdx-satisfies' {
    export default function satisfies(expression: string, approved: string[]): boolean;
}
