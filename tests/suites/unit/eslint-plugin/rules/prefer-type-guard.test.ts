import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('prefer-type-guard', plugin.rules['prefer-type-guard'], {
    valid: [
        'function isFish(pet: Pet) { return (pet as Fish).swim === undefined; }',
        'function isFish(pet: Pet) { return (pet as Fish).swim !== null; }',
        'function isFish(pet: Pet) { return !(pet as Fish).swim; }',
        'function isFish(pet: Pet) { return load((pet as Fish).swim); }',

        'function isFish(pet: Pet): pet is Fish { return (pet as Fish).swim !== undefined; }',
        'function isFish(pet: Pet, other: Pet) { return (pet as Fish).swim !== undefined; }',
        'function isFish(pet: Pet) { return (pet as any).swim !== undefined; }',
        'function isFish(pet: Pet) { log(pet); return (pet as Fish).swim !== undefined; }',
    ],
    invalid: [
        {
            code: 'function isFish(pet: Pet) { return (pet as Fish).swim !== undefined; }',
            errors: [{ messageId: 'guard', data: { value: 'pet', type: 'Fish' } }],
        },
        { code: 'function isFish(pet: Pet) { return Boolean((pet as Fish).swim); }', errors: [{ messageId: 'guard' }] },
        { code: 'function isFish(pet: Pet) { return !!(pet as Fish).swim; }', errors: [{ messageId: 'guard' }] },
        {
            code: 'class Pet { isFish() { return (this as Fish).swim !== undefined; } }',
            errors: [{ messageId: 'guard', data: { value: 'this', type: 'Fish' } }],
        },
    ],
});
