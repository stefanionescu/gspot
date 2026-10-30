import { z } from 'zod';
import { DOCSTRING_STYLES } from '#cli/config/checks/language/python.ts';

const toolDeptrySchema = z.object({
    extend_exclude: z.string().array().default([]),
    known_first_party: z.string().array().default([]),
});

export const deptrySchema = z.object({
    tool: z
        .object({
            deptry: toolDeptrySchema.default({ extend_exclude: [], known_first_party: [] }),
        })
        .default({ deptry: { extend_exclude: [], known_first_party: [] } }),
});

const pydoclintSchema = z.object({ style: z.enum(DOCSTRING_STYLES).optional() });

const pydocstyleSchema = z.object({ convention: z.unknown().optional() });
const lintSchema = z.object({
    pydocstyle: pydocstyleSchema.default({}),
});
const ruffSchema = z.object({
    lint: lintSchema.default({ pydocstyle: {} }),
});
const toolSchema = z.object({
    pydoclint: pydoclintSchema.catchall(z.unknown()).default({}),
    ruff: ruffSchema.default({ lint: { pydocstyle: {} } }),
});

export const docstringStyleSchema = z.object({
    tool: toolSchema.default({ pydoclint: {}, ruff: { lint: { pydocstyle: {} } } }),
});
