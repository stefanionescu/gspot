import { z } from 'zod';
import { relativePath } from '#cli/policy/schema/fields.ts';
import { RULES_DIRECTORY } from '#cli/config/platform/locations.ts';

export const agentRulesSchema = z.strictObject({
    enabled: z
        .boolean()
        .default(true)
        .meta({ description: 'Install the rules for coding agents and the agent instructions.' }),
    folder: relativePath.default(RULES_DIRECTORY).describe('Repository-relative folder the rules install into.'),
    project_folder: relativePath.optional().meta({
        description: "Repository-relative folder of the repository's own rules, linked from the instructions.",
    }),
    exclude: z
        .array(z.string())
        .default([])
        .meta({ description: 'Rule files and folders left out of the installed selection.' }),
    instruction_files: z.array(relativePath).default([]).meta({
        description:
            'Other files that get the managed block, besides AGENTS.md. Paths are relative to the repository root.',
    }),
});
