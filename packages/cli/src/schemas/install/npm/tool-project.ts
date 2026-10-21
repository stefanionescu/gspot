import { z } from 'zod';
import semver from 'semver';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { NpmProjectFile } from '#cli/types/tools/project.ts';
import { NPM_TOOL_PROJECT, NEXT_ESLINT_PLUGIN, NEXT_ESLINT_PLUGIN_MAJOR } from '#cli/config/parsers/dependencies.ts';

const toolDependencyVersion = z.string().refine((value) => semver.valid(value) !== null) satisfies z.ZodType<string>;

export const toolProjectSchema = z.strictObject({
    private: z.literal(NPM_TOOL_PROJECT.private),
    devDependencies: z
        .object({
            [NEXT_ESLINT_PLUGIN]: toolDependencyVersion.or(z.string().regex(NEXT_ESLINT_PLUGIN_MAJOR)).optional(),
        } satisfies SchemaShape<Pick<NpmProjectFile['devDependencies'], typeof NEXT_ESLINT_PLUGIN>>)
        .catchall(toolDependencyVersion),
} satisfies SchemaShape<NpmProjectFile>) satisfies z.ZodType<NpmProjectFile>;
