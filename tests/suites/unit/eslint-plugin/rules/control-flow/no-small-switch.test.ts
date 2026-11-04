import { noSmallSwitch } from '#eslint-plugin/rules/control-flow/no-small-switch.ts';
import { buildRuleTester, buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-small-switch', noSmallSwitch, {
    valid: [
        'switch (mode) { case 1: run(); break; case 2: stop(); }',
        'switch (mode) { case 1: run(); break; case 2: stop(); break; default: wait(); }',
        'declare const mode: "dark"; switch (mode) { case "dark": paint(); break; default: const unreachable: never = mode; }',
    ],
    invalid: [
        { code: 'switch (mode) { case 1: run(); }', errors: [{ messageId: 'small' }] },
        { code: 'switch (mode) {}', errors: [{ messageId: 'small' }] },
        { code: 'switch (mode) { case 1: run(); break; default: stop(); }', errors: [{ messageId: 'small' }] },
        {
            code: 'declare const mode: "dark"; switch (mode) { case "dark": paint(); break; default: const other: never = fail(); }',
            errors: [{ messageId: 'small' }],
        },
    ],
});

buildTypedRuleTester().run('no-small-switch with types', noSmallSwitch, {
    valid: [
        'declare function assertNever(value: never): never; declare const mode: "dark"; switch (mode) { case "dark": paint(); break; default: assertNever(mode); }',
    ],
    invalid: [
        {
            code: 'declare function fail(value: unknown): never; declare const mode: "dark"; switch (mode) { case "dark": paint(); break; default: fail(mode); }',
            errors: [{ messageId: 'small' }],
        },
        {
            code: 'declare function fail(value: never): never; declare function run(): void; declare const mode: "dark"; function a() { switch (mode) { case "dark": run(); break; default: mode; } }',
            errors: [{ messageId: 'small' }],
        },
    ],
});
