// The Emscripten factory inside the libpg-query package, which ships no types for it.
declare module 'libpg-query/wasm/libpg-query.js' {
    const createModule: (options: {
        locateFile: () => string;
    }) => Promise<import('#cli/parsers/sql/types.ts').PgModule>;
    export default createModule;
}

declare module 'spdx-expression-parse' {
    export default function parse(expression: string): unknown;
}

declare module 'spdx-satisfies' {
    export default function satisfies(expression: string, approved: string[]): boolean;
}
