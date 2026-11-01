import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-keyword-declarations', plugin.rules['no-keyword-declarations'], {
    valid: [
        'const packageName = "example";',
        'const options = { class: 1, public: 2, package: 3 };',
        'options.private = value;',
        'class Options { public = 1; static protected = 2; }',
        'import { private as value } from "example";',
        'import type { interface as Contract } from "example";',
        'const { public: value } = options;',
        'type Options = { package: string };',
        'private;',
    ],
    invalid: [
        ...['implements', 'interface', 'package', 'private', 'protected', 'public', 'static', 'yield', 'await'].map(
            (name) => ({
                code: `var ${name} = 0;`,
                errors: [{ messageId: 'keyword' as const, data: { name } }],
            }),
        ),
        ...[
            'function read(package) { return package; }',
            'function read() { const package = "example"; return package; }',
            'try { run(); } catch (package) { report(package); }',
            'const { public } = options;',
            'var package; var package;',
            'type interface = string;',
            'declare const package: string;',
            'import { value as static } from "example";',
        ].map((code) => ({ code, errors: [{ messageId: 'keyword' as const }] })),
        {
            code: 'var package; function read() { let package; }',
            errors: [{ messageId: 'keyword' }, { messageId: 'keyword' }],
        },
    ],
});
