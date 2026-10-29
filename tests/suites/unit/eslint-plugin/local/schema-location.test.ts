import { Linter } from 'eslint';
import { test, expect } from 'bun:test';
import { createRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { schemaLocation } from '#eslint-plugin-local/schema-location.ts';
import type { SchemaLocationOptions } from '#eslint-plugin-local/types.ts';

createRuleTester().run<'location', [Partial<SchemaLocationOptions[0]>]>('schema-location', schemaLocation, {
    valid: [
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
        ...[
            'import { z } from "zod"; export const name = z.coerce.string();',
            'import { iso } from "zod"; export const date = iso.datetime();',
            'import { z } from "zod"; export const name = z.lazy(readSchema);',
            'import { z } from "zod"; export const name = z.string();',
            'import { z as schema } from "zod"; export const name = schema.string();',
            'import * as schema from "zod"; export const name = schema.string();',
            'import { string as text } from "zod"; export const name = text();',
        ].map((code) => ({
            code,
            filename: '/repo/src/parsers/name.ts',
            errors: [{ messageId: 'location' as const }],
        })),
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

createRuleTester().run('schema-location regressions', schemaLocation, {
    valid: [
        {
            code: "import { z } from 'zod';\nz.globalRegistry.add(schema, {});\nexport const result = z.safeParse(schema, value);",
            filename: '/repo/src/parsers/name.ts',
            name: 'z.globalRegistry and z.safeParse only read schemas',
        },
    ],
    invalid: [
        {
            code: "import { z } from 'zod';\nexport const flag = z.stringbool();",
            filename: '/repo/src/parsers/name.ts',
            name: 'z.stringbool() outside the schema folders reports',
            errors: [{ messageId: 'location' }],
        },
        {
            code: "import { z } from 'zod';\nexport const text = z.fromJSONSchema({ type: 'string' });",
            filename: '/repo/src/parsers/name.ts',
            name: 'z.fromJSONSchema() outside the schema folders reports',
            errors: [{ messageId: 'location' }],
        },
        {
            code: "import { z } from 'zod';\nexport const minimum = z.minLength(3);",
            filename: '/repo/src/parsers/name.ts',
            name: 'a check built with z.minLength() outside the schema folders reports',
            errors: [{ messageId: 'location' }],
        },
    ],
});
