import 'zod/v4/core';

// The runtime provides RegExp.escape before the standard TypeScript declarations include it.
declare global {
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- reason: TypeScript extends the built-in RegExp constructor through an interface.
    interface RegExpConstructor {
        escape(text: string): string;
    }
}

// Zod reads the path role from schema metadata.
declare module 'zod/v4/core' {
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- reason: Zod reads extra metadata types only from an interface.
    interface GlobalMeta {
        pathRole?: 'source' | 'destination' | 'build';
    }
}
