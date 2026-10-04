import { z } from 'zod';

/** Linkinator output from the isolated static-site build. */
export const linkinatorReportSchema = z.object({
    links: z.array(
        z.object({
            url: z.string(),
            state: z.enum(['OK', 'BROKEN', 'SKIPPED']),
            status: z.number().optional(),
            parent: z.string().optional(),
        }),
    ),
});

/** HTML diagnostics for every validated output page. */
export const htmlValidationReportSchema = z.array(
    z.object({
        filePath: z.string(),
        messages: z.array(z.object({ ruleId: z.string(), line: z.number(), message: z.string() })),
    }),
);

/** PurgeCSS selectors rejected from each selected stylesheet. */
export const purgecssReportSchema = z.array(z.object({ file: z.string().min(1), rejected: z.array(z.string()) }));

/** Web manifest fields for checking the application name and local icon paths. */
export const webManifestSchema = z.object({
    name: z.unknown().optional(),
    icons: z.array(z.object({ src: z.string().optional() })).optional(),
});
