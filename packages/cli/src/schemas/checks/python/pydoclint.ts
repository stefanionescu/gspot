import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { DOCSTRING_STYLES } from '#cli/config/checks/python.ts';
import { type DocstringConfiguration } from '#cli/types/checks/python.ts';

export const docstringStyleSchema = z.object({
    tool: z
        .object({
            pydoclint: z
                .object({ style: z.enum(DOCSTRING_STYLES).optional() } satisfies SchemaShape<
                    Pick<DocstringConfiguration['tool']['pydoclint'], 'style'>
                >)
                .catchall(z.unknown())
                .default({}),
            ruff: z
                .object({
                    lint: z
                        .object({
                            pydocstyle: z
                                .object({ convention: z.unknown().optional() } satisfies SchemaShape<
                                    DocstringConfiguration['tool']['ruff']['lint']['pydocstyle']
                                >)
                                .default({}),
                        } satisfies SchemaShape<DocstringConfiguration['tool']['ruff']['lint']>)
                        .default({ pydocstyle: {} }),
                } satisfies SchemaShape<DocstringConfiguration['tool']['ruff']>)
                .default({ lint: { pydocstyle: {} } }),
        } satisfies SchemaShape<DocstringConfiguration['tool']>)
        .default({ pydoclint: {}, ruff: { lint: { pydocstyle: {} } } }),
} satisfies SchemaShape<DocstringConfiguration>) satisfies z.ZodType<DocstringConfiguration>;
