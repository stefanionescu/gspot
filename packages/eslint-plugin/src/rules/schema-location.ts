import { resolve } from 'node:path';
import { createRule } from '../schemas/rules/options.ts';
import { findZodSchemaConstructors } from '../syntax.ts';
import { DEFAULT_SCHEMA_FOLDERS } from '../config/schemas.ts';
import type { SchemaLocationOptions } from '../types/rules.ts';
import { locationOptionsSchema } from '../schemas/rules/schema-location.ts';

export const schemaLocation = createRule<SchemaLocationOptions, 'location'>({
    name: 'schema-location',
    meta: {
        defaultOptions: [{ folders: DEFAULT_SCHEMA_FOLDERS }],
        type: 'suggestion',
        docs: {
            level: 'none',
            description: 'Requires Zod schema construction in the configured schema folders.',
            why: 'A schema folder makes runtime validation contracts easy to find.',
            fix: 'Move the schema declaration into a configured schema folder and import it where it is used.',
            example: 'Move `const nameSchema = z.string()` from a parser into `src/schemas/name.ts`.',
        },
        schema: [locationOptionsSchema],
        messages: { location: 'Declare this Zod schema in a configured schema folder: {{folders}}.' },
    },
    create(context, [options]) {
        const path = resolve(context.cwd, context.physicalFilename)
            .replaceAll('\\', '/')
            .replace(/^[a-z]:/u, (drive) => drive.toUpperCase());
        const folders = options.folders.map((folder) =>
            resolve(context.cwd, folder)
                .replaceAll('\\', '/')
                .replace(/^[a-z]:/u, (drive) => drive.toUpperCase()),
        );
        if (folders.some((folder) => path === folder || path.startsWith(`${folder}/`))) return {};
        return {
            Program() {
                for (const node of findZodSchemaConstructors(context.sourceCode)) {
                    context.report({ node, messageId: 'location', data: { folders: options.folders.join(', ') } });
                }
            },
        };
    },
});
