import 'zod/v4/core';
import type { PATH_ROLES } from '#cli/config/manifests.ts';

declare module 'zod/v4/core' {
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- reason: Only an interface merges into the GlobalMeta of zod; a type alias cannot.
    interface GlobalMeta {
        path_role?: (typeof PATH_ROLES)[number];
    }
}
