import { z } from 'zod';

/** The source targets and exact source paths reported by Swift Package Manager. */
export const swiftPackageCoverageSchema = z.object({
    targets: z.array(
        z.object({
            name: z.string().min(1),
            path: z.string(),
            type: z.string(),
            module_type: z.string(),
            sources: z.array(z.string()),
        }),
    ),
});

/** Native compiler coverage export with source line counts. */
export const swiftCoverageSchema = z.object({
    data: z.array(
        z.object({
            files: z.array(
                z.object({
                    filename: z.string(),
                    summary: z.object({
                        lines: z.object({
                            count: z.number().int().nonnegative(),
                            covered: z.number().int().nonnegative(),
                        }),
                    }),
                }),
            ),
        }),
    ),
});
