import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';

import type {
    ToolAdvisory,
    ToolAdvisoryReport,
    ToolAdvisoryResult,
    ToolAdvisoryPackage,
} from '#tests/types/tool-projects.ts';

const toolAdvisoryPackageSchema = z.object({
    package: z.object({ name: z.string(), version: z.string() } satisfies SchemaShape<ToolAdvisoryPackage['package']>),
    vulnerabilities: z
        .object({
            id: z.string(),
            aliases: z.string().array().optional(),
        } satisfies SchemaShape<ToolAdvisory>)
        .array()
        .optional(),
} satisfies SchemaShape<ToolAdvisoryPackage>);

const toolAdvisoryResultSchema = z.object({
    source: z.object({ path: z.string() } satisfies SchemaShape<ToolAdvisoryResult['source']>),
    packages: toolAdvisoryPackageSchema.array(),
} satisfies SchemaShape<ToolAdvisoryResult>);

export const toolAdvisoryReportSchema = z.object({
    results: toolAdvisoryResultSchema.array().optional(),
} satisfies SchemaShape<ToolAdvisoryReport>);
