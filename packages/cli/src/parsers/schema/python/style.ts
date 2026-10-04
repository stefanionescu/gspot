import { z } from 'zod';

export const pyprojectSchema = z.object({
    tool: z
        .object({
            pydoclint: z.object({ style: z.unknown().optional() }).default({}),
            ruff: z
                .object({
                    lint: z
                        .object({
                            pydocstyle: z.object({ convention: z.unknown().optional() }).default({}),
                        })
                        .default({ pydocstyle: {} }),
                })
                .default({ lint: { pydocstyle: {} } }),
        })
        .default({ pydoclint: {}, ruff: { lint: { pydocstyle: {} } } }),
});
