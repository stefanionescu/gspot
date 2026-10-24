import 'zod/v4/core';
import type { PATH_ROLES } from '#cli/config/settings/available.ts';

declare global {
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- reason: TypeScript extends the built-in RegExp constructor through an interface.
    interface RegExpConstructor {
        escape(text: string): string;
    }
}

declare module 'zod/v4/core' {
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- reason: Zod reads extra metadata types only from an interface.
    interface GlobalMeta {
        path_role?: (typeof PATH_ROLES)[number];
    }
}
