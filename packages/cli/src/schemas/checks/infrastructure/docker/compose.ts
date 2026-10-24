import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { type ComposeService, type ComposeConfiguration } from '#cli/types/checks/infrastructure/docker.ts';

const buildSchema = z.object({
    context: z.string().optional(),
    dockerfile: z.string().optional(),
} satisfies SchemaShape<NonNullable<ComposeService['build']>>);
const servicesSchema = z.object({
    image: z.string().min(1).optional(),
    build: (
        z.union([
            z.string().transform((context) => ({ context, dockerfile: undefined })) satisfies z.ZodType<
                NonNullable<ComposeService['build']>,
                string
            >,
            buildSchema,
        ]) satisfies z.ZodType<NonNullable<ComposeService['build']>, string | NonNullable<ComposeService['build']>>
    ).optional(),
} satisfies SchemaShape<NonNullable<ComposeConfiguration['services']>[string]>);

export const composeSchema = z.object({
    services: z.record(z.string(), servicesSchema).optional(),
} satisfies SchemaShape<ComposeConfiguration>);
