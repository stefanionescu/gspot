import { test, expect } from 'bun:test';
import { collectRules } from '#cli/generation/rule-capture.ts';
import { RULE_CAPTURE_REFUSALS } from '#tests/config/rule-capture.ts';

test('rule capture ignores selector order and keeps record values and changed options', () => {
    const before = collectRules(['selectors', 'rules'], {
        selectors: ['first', 'second'],
        rules: [
            { id: 'first', pattern: 'eval(...)' },
            { id: 'second', pattern: 'exec(...)' },
        ],
    });
    const reordered = collectRules(['selectors', 'rules'], {
        selectors: ['second', 'first'],
        rules: [
            { id: 'second', pattern: 'exec(...)' },
            { id: 'first', pattern: 'eval(...)' },
        ],
    });
    expect(reordered).toStrictEqual(before);
    const next = collectRules(['rules'], {
        rules: [
            { id: 'first', pattern: 'other(...)' },
            { id: 'third', pattern: 'exec(...)' },
        ],
    });
    expect(before).toStrictEqual({
        selectors: { first: true, second: true },
        rules: { first: { id: 'first', pattern: 'eval(...)' }, second: { id: 'second', pattern: 'exec(...)' } },
    });
    expect(next).toStrictEqual({
        rules: { first: { id: 'first', pattern: 'other(...)' }, third: { id: 'third', pattern: 'exec(...)' } },
    });
});

test.each([...RULE_CAPTURE_REFUSALS])(
    'rule capture refuses ambiguous rule data: $message',
    ({ document, message: diagnostic }) => {
        expect(() => collectRules(['rules'], document)).toThrow(diagnostic);
    },
);

test("rule capture keeps each tool's rule groups apart and gives absent paths an empty group", () => {
    expect(
        collectRules(['*.BasedOnStyles', '*.rules', 'checks', 'skips', 'sqlfluff.exclude_rules', 'sqlfluff:rules'], {
            '*': { BasedOnStyles: ['Vale', 'Example'], rules: { 'Example.Rule': true } },
            checks: ['ssrf', 'aliastraversal'],
            skips: ['ssrf'],
            sqlfluff: { exclude_rules: ['CP01', 'LT01'] },
            'sqlfluff:rules': { 'capitalisation.keywords': { capitalisation_policy: 'upper' } },
        }),
    ).toStrictEqual({
        '*.BasedOnStyles': { Vale: true, Example: true },
        '*.rules': { 'Example.Rule': true },
        checks: { ssrf: true, aliastraversal: true },
        skips: { ssrf: true },
        'sqlfluff.exclude_rules': { CP01: true, LT01: true },
        'sqlfluff:rules': { 'capitalisation.keywords': { capitalisation_policy: 'upper' } },
    });
    expect(collectRules(['missing', 'rules'], { rules: null })).toStrictEqual({ missing: {}, rules: {} });
});
