import { resolve } from 'node:path';
import { createRule } from '../src/create-rule.ts';
import { convertToPosixPath } from '../src/syntax.ts';
import type { JSONSchema4 } from '@typescript-eslint/utils/json-schema';
import { ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

export type SchemaLocationOptions = [{ folders: readonly string[] }];

const OPTIONS_SCHEMA = {
    type: 'object',
    properties: {
        folders: {
            description: 'Repository folders that own runtime schemas, relative to the ESLint working directory.',
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
        },
    },
    additionalProperties: false,
} satisfies JSONSchema4;

const ZOD_MODULES = ['zod', 'zod/v3', 'zod/v4', 'zod/mini', 'zod/v4-mini', 'zod/v4/mini'] as const;

const ZOD_SCHEMA_FACTORIES = [
    '_default',
    '_function',
    'any',
    'array',
    'base64',
    'base64url',
    'bigint',
    'boolean',
    'catch',
    'cidrv4',
    'cidrv6',
    'codec',
    'creditCard',
    'cuid',
    'cuid2',
    'custom',
    'date',
    'discriminatedUnion',
    'e164',
    'email',
    'emoji',
    'enum',
    'exactOptional',
    'file',
    'float32',
    'float64',
    'function',
    'guid',
    'hash',
    'hex',
    'hostname',
    'httpUrl',
    'iban',
    'instanceof',
    'int',
    'int32',
    'int64',
    'intersection',
    'invertCodec',
    'ipv4',
    'ipv6',
    'json',
    'jwt',
    'keyof',
    'ksuid',
    'lazy',
    'literal',
    'looseObject',
    'looseRecord',
    'mac',
    'map',
    'nan',
    'nanoid',
    'nativeEnum',
    'never',
    'nonoptional',
    'null',
    'nullable',
    'nullish',
    'number',
    'object',
    'optional',
    'partialRecord',
    'pipe',
    'prefault',
    'preprocess',
    'promise',
    'readonly',
    'record',
    'set',
    'strictObject',
    'string',
    'stringFormat',
    'success',
    'symbol',
    'templateLiteral',
    'transform',
    'tuple',
    'uint32',
    'uint64',
    'ulid',
    'undefined',
    'union',
    'unknown',
    'url',
    'uuid',
    'uuidv4',
    'uuidv6',
    'uuidv7',
    'void',
    'xid',
    'xor',
] as const;

const DEFAULT_SCHEMA_FOLDERS = ['src/schemas'] as const;

const ZOD_SCHEMA_NAMESPACES = {
    coerce: ['bigint', 'boolean', 'date', 'number', 'string'],
    iso: ['date', 'datetime', 'duration', 'time'],
} as const;

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
