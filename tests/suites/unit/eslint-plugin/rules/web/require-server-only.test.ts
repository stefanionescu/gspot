import { expect, test } from 'bun:test';
import { Linter } from 'eslint';

import plugin from '#eslint-plugin/plugin.ts';
import { requireServerOnly } from '#eslint-plugin/rules/web/require-server-only.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

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
        { code: "import type {} from 'server-only';\nexport const secret = 1;", errors: [{ messageId: 'missing' }] },
    ],
});

test('the default JavaScript parser accepts a server-only side-effect import', () => {
    const linter = new Linter({ configType: 'flat', cwd: '/repo' });
    const config: object = { plugins: { gspot: plugin }, rules: { 'gspot/require-server-only': 'error' } };
    expect(
        linter.verify("import 'server-only';\nexport const secret = 1;", config, {
            filename: '/repo/src/server/secret.js',
        }),
    ).toStrictEqual([]);
    expect(linter.verify('export const secret = 1;', config, { filename: '/repo/src/server/secret.js' })).toMatchObject(
        [{ messageId: 'missing' }],
    );
});
