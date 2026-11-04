import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noInsecureRandom } from '#eslint-plugin/rules/security/no-insecure-random.ts';

buildRuleTester().run('no-insecure-random', noInsecureRandom, {
    valid: [
        'crypto.randomUUID();',
        'function draw(Math) { return Math.random(); }',
        'const Math = { random() { return 1; } }; Math.random();',
        'const random = "round"; Math[random]();',
        'let draw = Math.random; draw = other; draw();',
        'let first = second; let second = first; first();',
    ],
    invalid: [
        { code: 'import draw = Math.random; draw();', errors: [{ messageId: 'random' }] },
        { code: 'Math.random();', errors: [{ messageId: 'random' }] },
        { code: 'const draw = Math.random; draw();', errors: [{ messageId: 'random' }] },
        { code: 'const { random: draw } = Math; draw();', errors: [{ messageId: 'random' }] },
        { code: 'const random = key; Math[random]();', errors: [{ messageId: 'random' }] },
        { code: 'const draw = Math.random!; draw();', errors: [{ messageId: 'random' }] },
    ],
});
