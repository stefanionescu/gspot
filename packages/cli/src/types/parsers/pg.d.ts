// The Emscripten factory inside the libpg-query package, which ships no types for it.
declare module 'libpg-query/wasm/libpg-query.js' {
    import type { PgModule } from '#cli/types/parsers/sql.ts';

    const createModule: (options: { locateFile: () => string }) => Promise<PgModule>;
    export default createModule;
}
