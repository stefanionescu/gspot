import { resolve } from 'node:path';
import { createRule } from '../create-rule.ts';
import { convertToPosixPath } from '../syntax.ts';
import type { SchemaLocationOptions } from '../types/rules.ts';
import { ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import {
    ZOD_MODULES,
    OPTIONS_SCHEMA,
    ZOD_SCHEMA_FACTORIES,
    ZOD_SCHEMA_NAMESPACES,
    DEFAULT_SCHEMA_FOLDERS,
} from '../config/rules/schema-location.ts';

function findZodSchemaConstructors(source: TSESLint.SourceCode): TSESTree.Node[] {
    const factories = Object.fromEntries(
        ZOD_SCHEMA_FACTORIES.map((name) => [name, { [ASTUtils.ReferenceTracker.CALL]: true }]),
    );
    const namespaces = Object.fromEntries(
        Object.entries(ZOD_SCHEMA_NAMESPACES).map(([name, methods]) => [
            name,
            Object.fromEntries(methods.map((method) => [method, { [ASTUtils.ReferenceTracker.CALL]: true }])),
        ]),
    );
    const constructors = { ...factories, ...namespaces };
    const imports = Object.fromEntries(
        ZOD_MODULES.map((name) => [
            name,
            { [ASTUtils.ReferenceTracker.ESM]: true, ...constructors, z: constructors, default: constructors },
        ]),
    );
    const tracker = new ASTUtils.ReferenceTracker(source.getScope(source.ast));
    return [...tracker.iterateEsmReferences(imports)].map((reference) => reference.node);
}

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
        schema: [OPTIONS_SCHEMA],
        messages: { location: 'Declare this Zod schema in a configured schema folder: {{folders}}.' },
    },
    create(context, [options]) {
        const path = convertToPosixPath(resolve(context.cwd, context.physicalFilename));
        const folders = options.folders.map((folder) => convertToPosixPath(resolve(context.cwd, folder)));
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
