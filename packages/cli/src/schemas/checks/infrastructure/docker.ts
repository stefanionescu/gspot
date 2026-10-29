import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';

import {
    type ComposeService,
    type TrivyImageOutput,
    type ComposeConfiguration,
} from '#cli/types/checks/infrastructure/docker.ts';

const buildSchema = z.object({
    context: z.string().optional(),
    dockerfile: z.string().optional(),
} satisfies SchemaShape<NonNullable<ComposeService['build']>>);

const serviceSchema = z.object({
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
    services: z.record(z.string(), serviceSchema).optional(),
} satisfies SchemaShape<ComposeConfiguration>);

const vulnerabilitySchema = z.object({
    VulnerabilityID: z.string().min(1),
    PkgName: z.string().min(1),
} satisfies SchemaShape<
    NonNullable<NonNullable<NonNullable<TrivyImageOutput['Results']>[number]['Vulnerabilities']>>[number]
>);

const secretSchema = z.object({ RuleID: z.string().min(1), Title: z.string().min(1) } satisfies SchemaShape<
    NonNullable<NonNullable<TrivyImageOutput['Results']>[number]['Secrets']>[number]
>);

export const trivyImageOutputSchema = z.object({
    Results: z
        .object({
            Vulnerabilities: vulnerabilitySchema.array().optional(),
            Secrets: secretSchema.array().optional(),
        } satisfies SchemaShape<NonNullable<TrivyImageOutput['Results']>[number]>)
        .array()
        .optional(),
} satisfies SchemaShape<TrivyImageOutput>);
