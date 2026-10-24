import { z } from 'zod';
import semver from 'semver';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { ToolPackageJson } from '#cli/types/install/npm.ts';
import { NPM_TOOL_PROJECT } from '#cli/config/generation/tool-projects.ts';

const toolDependencyVersion = z.string().refine((value) => semver.valid(value) !== null) satisfies z.ZodType<string>;

export const toolPackageJsonSchema = z.strictObject({
    private: z.literal(NPM_TOOL_PROJECT.private),
    devDependencies: z.record(z.string(), toolDependencyVersion),
} satisfies SchemaShape<ToolPackageJson>);
