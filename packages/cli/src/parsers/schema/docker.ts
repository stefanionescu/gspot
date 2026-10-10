import { z } from 'zod';
import { TRIVY_SCHEMA_VERSION } from '#cli/config/parsers/docker.ts';

export const imageReportSchema = z.object({
    SchemaVersion: z.literal(TRIVY_SCHEMA_VERSION),
    ArtifactName: z.string().min(1),
    Results: z
        .array(
            z.object({
                Target: z.string().min(1),
                Vulnerabilities: z
                    .array(
                        z.object({
                            VulnerabilityID: z.string().min(1),
                            PkgName: z.string().min(1),
                        }),
                    )
                    .optional(),
                Secrets: z.array(z.object({ RuleID: z.string().min(1), Title: z.string().min(1) })).optional(),
            }),
        )
        .optional(),
});

export const composeSchema = z.object({
    services: z
        .record(
            z.string(),
            z.object({
                image: z.string().min(1).optional(),
                build: z
                    .union([
                        z.string().transform((context) => ({ context, dockerfile: undefined })),
                        z.object({
                            context: z.string().optional(),
                            dockerfile: z.string().optional(),
                        }),
                    ])
                    .optional(),
            }),
        )
        .optional(),
});
