import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { TrivyImageReport } from '#cli/types/checks/infrastructure/docker.ts';

const vulnerabilitiesSchema = z.object({
    VulnerabilityID: z.string().min(1),
    PkgName: z.string().min(1),
} satisfies SchemaShape<
    NonNullable<NonNullable<NonNullable<TrivyImageReport['Results']>[number]['Vulnerabilities']>>[number]
>);

const secretsSchema = z.object({ RuleID: z.string().min(1), Title: z.string().min(1) } satisfies SchemaShape<
    NonNullable<NonNullable<TrivyImageReport['Results']>[number]['Secrets']>[number]
>);

export const imageReportSchema = z.object({
    Results: z
        .object({
            Vulnerabilities: vulnerabilitiesSchema.array().optional(),
            Secrets: secretsSchema.array().optional(),
        } satisfies SchemaShape<NonNullable<TrivyImageReport['Results']>[number]>)
        .array()
        .optional(),
} satisfies SchemaShape<TrivyImageReport>);
