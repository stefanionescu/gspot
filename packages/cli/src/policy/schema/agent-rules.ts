import { z } from 'zod';
import { RULES_DIRECTORY } from '#cli/config/platform/locations.ts';
import { defaultValue, relativePath, authoredDefault } from '#cli/policy/schema/contracts.ts';

export const agentRulesSchema = z.strictObject({
    enabled: authoredDefault(z.boolean().default(true)).meta({
        description: 'Write the agent rules and agent instructions.',
    }),
    folder: authoredDefault(relativePath.meta({ pathRole: 'destination' }).default(RULES_DIRECTORY)).describe(
        'Repository-relative folder the rules install into.',
    ),
    own_rules_folder: relativePath.optional().meta({
        description: "Repository-relative folder of the repository's own rules, linked from the instructions.",
    }),
    exclude: authoredDefault(z.array(z.string()).default([])).meta({
        description: 'Rule files and folders left out of the installed selection.',
    }),
    instruction_files: authoredDefault(z.array(relativePath.meta({ pathRole: 'destination' })).default([])).meta({
        description:
            'Other files that get the managed block, besides AGENTS.md. Paths are relative to the repository root.',
    }),
});

/** Resolve only the agent-rule defaults declared by the native authored schema. */
export const agentRulesValuesSchema = agentRulesSchema.transform((raw) => ({
    enabled: defaultValue(agentRulesSchema.shape.enabled, raw.enabled),
    folder: defaultValue(agentRulesSchema.shape.folder, raw.folder),
    exclude: defaultValue(agentRulesSchema.shape.exclude, raw.exclude),
    instruction_files: defaultValue(agentRulesSchema.shape.instruction_files, raw.instruction_files),
    ...(raw.own_rules_folder === undefined ? undefined : { own_rules_folder: raw.own_rules_folder }),
}));
