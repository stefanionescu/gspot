import 'zod/v4/core';
import type { PATH_ROLES } from '#cli/config/settings/schema.ts';

declare global {
    interface RegExpConstructor {
        escape(text: string): string;
    }
}

declare module 'zod/v4/core' {
    interface GlobalMeta {
        path_role?: (typeof PATH_ROLES)[number];
    }
}
