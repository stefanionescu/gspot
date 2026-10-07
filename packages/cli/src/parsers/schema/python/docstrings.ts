import { z } from 'zod';

export const docstringStyleSchema = z.object({
    tool: z
        .object({
            pydoclint: z
                .object({ style: z.enum(['google', 'numpy', 'sphinx']).optional() })
                .catchall(z.unknown())
                .default({}),
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
