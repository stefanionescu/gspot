import type { z } from 'zod';
import { type ReasonedValue } from '#cli/types/settings/values.ts';
import type { LIMIT_DEFINITIONS } from '#cli/config/settings/definitions/limits.ts';

export type LimitSchemas = {
    [Key in keyof typeof LIMIT_DEFINITIONS as Key extends `limits.${infer Field}` ? Field : never]: z.ZodDefault<
        z.ZodUnion<readonly [z.ZodType<number, number>, z.ZodType<number, ReasonedValue<number>>]>
    >;
};
