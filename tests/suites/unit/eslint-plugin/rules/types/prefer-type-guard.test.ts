import { preferTypeGuard } from '#eslint-plugin/rules/types/prefer-type-guard.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('prefer-type-guard', preferTypeGuard, {
    valid: [
        'function isFish(pet: Pet) { return (pet as Fish).swim === undefined; }',
        'function isFish(pet: Pet) { return (pet as Fish).swim !== null; }',
        'function isFish(pet: Pet) { return !(pet as Fish).swim; }',
        'function isFish(pet: Pet) { return load((pet as Fish).swim); }',

        'function isFish(pet: Pet): pet is Fish { return (pet as Fish).swim !== undefined; }',
        'function isFish(pet: Pet, other: Pet) { return (pet as Fish).swim !== undefined; }',
        'function isFish(pet: Pet) { return (pet as any).swim !== undefined; }',
        'function isFish(pet: Pet) { log(pet); return (pet as Fish).swim !== undefined; }',
        'function isSet(pet: Pet) { return pet !== undefined; }',
        'function check() { return (pet as Fish).swim !== undefined; }',
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
        {
            code: 'function isCat(value: unknown): boolean { return (<Cat>value).meow !== undefined; }',
            filename: 'file.ts',
            languageOptions: { parserOptions: { ecmaFeatures: { jsx: false } } },
            errors: [{ messageId: 'guard' }],
        },
    ],
});
