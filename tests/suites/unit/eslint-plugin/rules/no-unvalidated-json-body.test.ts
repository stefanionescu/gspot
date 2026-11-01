import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-unvalidated-json-body', plugin.rules['no-unvalidated-json-body'], {
    valid: [
        'const body = Order.parse(await req.json());',
        'const body = await Order.safeParseAsync(await request.json());',
        'const body = await req.json();\nconst order = Order.safeParse(body);',
        'const data = await response.json();',
    ],
    invalid: [
        { code: 'const body = await req.json();', errors: [{ messageId: 'unvalidated', column: 14 }] },
        { code: 'save(await request.json());', errors: [{ messageId: 'unvalidated' }] },
        {
            code: 'const body = await req.json();\nconst order = Order.parse(other);',
            errors: [{ messageId: 'unvalidated', line: 1 }],
        },
    ],
});
