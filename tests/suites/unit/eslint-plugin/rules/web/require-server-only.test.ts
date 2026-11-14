import { Linter } from 'eslint';
import { test, expect } from 'bun:test';
import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { requireServerOnly } from '#eslint-plugin/rules/web/require-server-only.ts';

buildRuleTester().run('require-server-only', requireServerOnly, {
    valid: [
        "'use server';\nexport async function act() {}",
        "import marker from 'server-only';",
        "import { type Marker, value } from 'server-only';",
    ],
    invalid: [
        {
            code: "import { type Marker } from 'server-only';\nexport const secret = 1;",
            errors: [{ messageId: 'missing' }],
        },
        { code: "import {} from 'server-only';\nexport const secret = 1;", errors: [{ messageId: 'missing' }] },
        { code: 'export const secret = 1;', errors: [{ messageId: 'missing' }] },
        { code: "import db from './db';\nexport const secret = 1;", errors: [{ messageId: 'missing' }] },
        { code: "import type {} from 'server-only';\nexport const secret = 1;", errors: [{ messageId: 'missing' }] },
    ],
});

test('the default JavaScript parser accepts a server-only side-effect import', () => {
    const linter = new Linter({ configType: 'flat', cwd: '/repo' });
    const config: object = { plugins: { gspot: plugin }, rules: { 'gspot/require-server-only': 'error' } };
    const messages = linter.verify("import 'server-only';\nexport const secret = 1;", config, {
        filename: '/repo/src/server/secret.js',
    });
    expect(messages).toStrictEqual([]);
});
