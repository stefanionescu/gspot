import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';

import {
    type SwiftCoverage,
    type CoverageReport,
    type SwiftPackageDescription,
} from '#cli/types/checks/language/swift.ts';

export const packageDescriptionSchema = z.object({
    targets: z
        .object({
            name: z.string().min(1),
            path: z.string(),
            type: z.string(),
            module_type: z.string(),
            sources: z.string().array(),
        } satisfies SchemaShape<SwiftPackageDescription['targets'][number]>)
        .array(),
} satisfies SchemaShape<SwiftPackageDescription>);
const linesSchema = z.object({
    count: z.number().int().nonnegative(),
    covered: z.number().int().nonnegative(),
} satisfies SchemaShape<SwiftCoverage['data'][number]['files'][number]['summary']['lines']>);
const summarySchema = z.object({
    lines: linesSchema,
} satisfies SchemaShape<SwiftCoverage['data'][number]['files'][number]['summary']>);
const filesSchema = z.object({
    filename: z.string(),
    summary: summarySchema,
} satisfies SchemaShape<SwiftCoverage['data'][number]['files'][number]>);

export const swiftCoverageSchema = z.object({
    data: z
        .object({
            files: filesSchema.array(),
        } satisfies SchemaShape<SwiftCoverage['data'][number]>)
        .array(),
} satisfies SchemaShape<SwiftCoverage>);

export const xccovSchema = z.object({
    targets: z
        .object({ name: z.string().min(1), lineCoverage: z.number().min(0).max(1) } satisfies SchemaShape<
            CoverageReport['targets'][number]
        >)
        .array(),
} satisfies SchemaShape<CoverageReport>);
