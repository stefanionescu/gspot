import 'zod/v4/core';
import type { PATH_ROLES } from '#cli/config/manifests.ts';
import type { LEFT_OUT_NOTES } from '#cli/config/settings/schema.ts';
import type { ReasonRequirement } from '#cli/types/manifests.ts';

declare module 'zod/v4/core' {
    interface GlobalMeta {
        path_role?: (typeof PATH_ROLES)[number];
        configurations?: readonly string[];
        languages?: readonly string[];
        language_defaults?: Readonly<Record<string, unknown>>;
        default?: unknown;
        default_all?: unknown;
        reason_for?: ReasonRequirement;
        reason_values?: boolean;
        reasoned?: boolean;
        leftOut?: keyof typeof LEFT_OUT_NOTES;
        variantOf?: string;
        value_names?: 'configurations' | 'checks';
    }
}
