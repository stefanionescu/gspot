import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { DOCSTRING_STYLES } from '#cli/config/checks/language/python/pydoclint.ts';
import { type DocstringConfiguration } from '#cli/types/checks/language/python.ts';

const pydoclintSchema = z.object({ style: z.enum(DOCSTRING_STYLES).optional() } satisfies SchemaShape<
    Pick<DocstringConfiguration['tool']['pydoclint'], 'style'>
>);

const pydocstyleSchema = z.object({ convention: z.unknown().optional() } satisfies SchemaShape<
    DocstringConfiguration['tool']['ruff']['lint']['pydocstyle']
>);
const lintSchema = z.object({
    pydocstyle: pydocstyleSchema.default({}),
} satisfies SchemaShape<DocstringConfiguration['tool']['ruff']['lint']>);
const ruffSchema = z.object({
    lint: lintSchema.default({ pydocstyle: {} }),
} satisfies SchemaShape<DocstringConfiguration['tool']['ruff']>);
const toolSchema = z.object({
    pydoclint: pydoclintSchema.catchall(z.unknown()).default({}),
    ruff: ruffSchema.default({ lint: { pydocstyle: {} } }),
} satisfies SchemaShape<DocstringConfiguration['tool']>);

export const docstringStyleSchema = z.object({
    tool: toolSchema.default({ pydoclint: {}, ruff: { lint: { pydocstyle: {} } } }),
} satisfies SchemaShape<DocstringConfiguration>);
