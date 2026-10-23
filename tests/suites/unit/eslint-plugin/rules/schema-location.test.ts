import { Linter } from 'eslint';
import { test, expect } from 'bun:test';
import { createRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { schemaLocation } from '#eslint-plugin/rules/schema-location.ts';
import type { SchemaLocationOptions } from '#eslint-plugin/types/rules.ts';

createRuleTester().run<'location', [Partial<SchemaLocationOptions[0]>]>('schema-location', schemaLocation, {
    valid: [
        'import type { z } from "zod"; export const schema = z.string();',
        'import { type z } from "zod"; export const schema = z.string();',
        {
            code: 'import { z } from "zod"; export const name = z.string();',
            filename: '/src/schemas/name.ts',
        },
        {
            code: 'import { z } from "zod"; export const name = z.string();',
            filename: '/repo/src/schemas/name.ts',
            options: [{ folders: ['/repo/src/schemas'] }],
        },
        {
            code: 'import { z } from "zod"; export const name = z.string();',
            filename: '/repo/tests/schemas/name.ts',
            options: [{ folders: ['/repo/src/schemas', '/repo/tests/schemas'] }],
        },
        'import type { z } from "zod"; export type Name = z.ZodString;',
        'import { z } from "zod"; export const result = z.safeParse(schema, value);',
        'import { z } from "zod"; export const result = z.toJSONSchema(schema);',
        'import { z } from "zod"; export const result = value instanceof z.ZodString;',
        'const z = { string() { return "value"; } }; z.string();',
        'import { z } from "./owner"; z.string();',
        'import { z } from "zod"; function read(z) { return z.string(); }',
    ],
    invalid: [
        {
            code: 'import { z } from "zod"; export const name = z.coerce.string();',
            filename: '/repo/src/parsers/name.ts',
            errors: [{ messageId: 'location' }],
        },
        {
            code: 'import { iso } from "zod"; export const date = iso.datetime();',
            filename: '/repo/src/parsers/name.ts',
            errors: [{ messageId: 'location' }],
        },
        {
            code: 'import { z } from "zod"; export const name = z.lazy(readSchema);',
            filename: '/repo/src/parsers/name.ts',
            errors: [{ messageId: 'location' }],
        },
        {
            code: 'import { z } from "zod"; export const name = z.string();',
            filename: '/repo/src/parsers/name.ts',
            errors: [{ messageId: 'location' }],
        },
        {
            code: 'import { z as schema } from "zod"; export const name = schema.string();',
            filename: '/repo/src/parsers/name.ts',
            errors: [{ messageId: 'location' }],
        },
        {
            code: 'import * as schema from "zod"; export const name = schema.string();',
            filename: '/repo/src/parsers/name.ts',
            errors: [{ messageId: 'location' }],
        },
        {
            code: 'import { string as text } from "zod"; export const name = text();',
            filename: '/repo/src/parsers/name.ts',
            errors: [{ messageId: 'location' }],
        },
        {
            code: 'import { z } from "zod"; export const name = z.string();',
            filename: '/repo/src/schemas-other/name.ts',
            options: [{ folders: ['/repo/src/schemas'] }],
            errors: [{ messageId: 'location' }],
        },
    ],
});

test('schema placement resolves configured folders from the ESLint working directory', () => {
    const linter = new Linter({ configType: 'flat', cwd: '/repo' });
    const config: object[] = [
        {
            plugins: { gspot: { rules: { 'schema-location': schemaLocation } } },
            rules: { 'gspot/schema-location': ['error', { folders: ['src/schemas'] }] },
        },
    ];
    const source = 'import { z } from "zod"; export const schema = z.string();';
    expect(linter.verify(source, config, { filename: '/repo/src/schemas/name.js' })).toStrictEqual([]);
    const messages = linter.verify(source, config, { filename: '/repo/src/parsers/name.js' });
    expect(messages).toMatchObject([{ ruleId: 'gspot/schema-location', messageId: 'location' }]);
});
