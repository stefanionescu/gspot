import { z } from 'zod';
import type { SchemaShape } from '#cli/types/objects.ts';
import { relativePath } from '#cli/settings/schema/parts.ts';
import type { ParsedRules } from '#cli/types/settings/tables.ts';
import type { WrittenSettings } from '#cli/types/settings/file.ts';

export const rulesSchema = z.strictObject({
    enabled: z.boolean().default(true).meta({
        description: 'Write the rules and the managed block in AGENTS.md.',
    }),
    exclude: z.array(z.string()).default([]).meta({
        description: 'Rule files and folders left out of the installed selection.',
    }),
    instruction_files: z
        .array(relativePath.meta({ pathRole: 'destination' }))
        .default([])
        .meta({
            description:
                'Other files that get the managed block, besides AGENTS.md. Paths are relative to the repository root.',
        }),
} satisfies SchemaShape<ParsedRules, NonNullable<WrittenSettings['rules']>>);
