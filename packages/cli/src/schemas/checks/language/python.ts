import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { DOCSTRING_STYLES } from '#cli/config/checks/language/python.ts';
import { type DeptryConfiguration, type DocstringConfiguration } from '#cli/types/checks/language/python.ts';

const toolDeptrySchema = z.object({
    extend_exclude: z.string().array().default([]),
    known_first_party: z.string().array().default([]),
} satisfies SchemaShape<DeptryConfiguration['tool']['deptry']>);

export const deptrySchema = z.object({
    tool: z
        .object({
            deptry: toolDeptrySchema.default({ extend_exclude: [], known_first_party: [] }),
        } satisfies SchemaShape<DeptryConfiguration['tool']>)
        .default({ deptry: { extend_exclude: [], known_first_party: [] } }),
} satisfies SchemaShape<DeptryConfiguration>);

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
