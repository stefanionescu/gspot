import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-insecure-random', plugin.rules['no-insecure-random'], {
    valid: [
        'crypto.randomUUID();',
        'crypto.getRandomValues(new Uint8Array(8));',
        'function draw(Math) { return Math.random(); }',
        'const Math = { random() { return 1; } }; Math.random();',
        'const random = "round"; Math[random]();',
        'let draw = Math.random; draw = other; draw();',
        'let first = second; let second = first; first();',
    ],
    invalid: [
        { code: 'import draw = Math.random; draw();', errors: [{ messageId: 'random' }] },
        { code: 'Math.random();', errors: [{ messageId: 'random' }] },
        { code: 'Math["random"]();', errors: [{ messageId: 'random' }] },
        { code: 'const draw = Math.random; draw();', errors: [{ messageId: 'random' }] },
        { code: 'const { random: draw } = Math; draw();', errors: [{ messageId: 'random' }] },
        { code: 'const math = Math; math.random();', errors: [{ messageId: 'random' }] },
        { code: 'Math = other; Math.random();', errors: [{ messageId: 'random' }] },
        { code: 'const random = key; Math[random]();', errors: [{ messageId: 'random' }] },
        { code: 'const random = "random"; Math[random]();', errors: [{ messageId: 'random' }] },
        { code: 'const draw = Math.random!; draw();', errors: [{ messageId: 'random' }] },
        { code: 'Math.random?.();', errors: [{ messageId: 'random' }] },
        { code: 'let draw; draw = Math.random; draw();', errors: [{ messageId: 'random' }] },
    ],
});
