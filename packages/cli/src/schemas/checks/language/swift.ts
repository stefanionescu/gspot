import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';

import {
    type SwiftCoverage,
    type CoverageReport,
    type SwiftPackageCoverage,
} from '#cli/types/checks/language/swift.ts';

export const packageDescriptionSchema = z.object({
    targets: z.array(
        z.object({
            name: z.string().min(1),
            path: z.string(),
            type: z.string(),
            module_type: z.string(),
            sources: z.array(z.string()),
        } satisfies SchemaShape<SwiftPackageCoverage['targets'][number]>),
    ),
} satisfies SchemaShape<SwiftPackageCoverage>);

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
                        } satisfies SchemaShape<SwiftCoverage['data'][number]['files'][number]['summary']['lines']>),
                    } satisfies SchemaShape<SwiftCoverage['data'][number]['files'][number]['summary']>),
                } satisfies SchemaShape<SwiftCoverage['data'][number]['files'][number]>),
            ),
        } satisfies SchemaShape<SwiftCoverage['data'][number]>),
    ),
} satisfies SchemaShape<SwiftCoverage>);

export const xccovSchema = z.object({
    targets: z.array(
        z.object({ name: z.string().min(1), lineCoverage: z.number().min(0).max(1) } satisfies SchemaShape<
            CoverageReport['targets'][number]
        >),
    ),
} satisfies SchemaShape<CoverageReport>);
