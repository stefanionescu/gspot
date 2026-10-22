import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { TrivyImageReport } from '#cli/types/checks/infrastructure/docker.ts';
import { TRIVY_SCHEMA_VERSION } from '#cli/config/checks/infrastructure/docker/trivy-image.ts';

export const imageReportSchema = z.object({
    SchemaVersion: z.literal(TRIVY_SCHEMA_VERSION),
    Results: z
        .array(
            z.object({
                Vulnerabilities: z
                    .array(
                        z.object({
                            VulnerabilityID: z.string().min(1),
                            PkgName: z.string().min(1),
                        } satisfies SchemaShape<
                            NonNullable<
                                NonNullable<NonNullable<TrivyImageReport['Results']>[number]['Vulnerabilities']>
                            >[number]
                        >),
                    )
                    .optional(),
                Secrets: z
                    .array(
                        z.object({ RuleID: z.string().min(1), Title: z.string().min(1) } satisfies SchemaShape<
                            NonNullable<NonNullable<TrivyImageReport['Results']>[number]['Secrets']>[number]
                        >),
                    )
                    .optional(),
            } satisfies SchemaShape<NonNullable<TrivyImageReport['Results']>[number]>),
        )
        .optional(),
} satisfies SchemaShape<TrivyImageReport>);
