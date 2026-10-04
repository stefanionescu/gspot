import { test, expect } from 'bun:test';
import { explain } from '#cli/commands/explain/command.ts';

test('a tool rule is explained with the page its manifest declares', () => {
    const shellcheck = explain(undefined, 'shellcheck/SC2086');
    expect(shellcheck).toMatchObject({
        kind: 'tool-rule',
        data: { tool: 'shellcheck', rule: 'SC2086', page: 'https://www.shellcheck.net/wiki/SC2086' },
    });
    expect(shellcheck.text).toContain('gspot ignore bash/shellcheck --rule SC2086');
    expect(shellcheck.text).not.toContain('tools.shellcheck.rules');
    expect(explain(undefined, 'no-undef')).toMatchObject({
        kind: 'tool-rule',
        subject: 'eslint/no-undef',
        data: { page: 'https://eslint.org/docs/latest/rules/no-undef' },
    });
    expect(explain(undefined, 'no-var')).toMatchObject({
        kind: 'tool-rule',
        subject: 'eslint/no-var',
        data: { page: 'https://eslint.org/docs/latest/rules/no-var' },
    });
    expect(explain(undefined, 'eslint/no-var')).toMatchObject({
        data: { page: 'https://eslint.org/docs/latest/rules/no-var' },
    });
});

test('a plugin rule is explained with the page of the plugin whose prefix it carries', () => {
    expect(explain(undefined, 'eslint/unicorn/prefer-set-has')).toMatchObject({
        data: { page: 'https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-set-has.md' },
    });
    expect(explain(undefined, 'eslint/@typescript-eslint/no-explicit-any')).toMatchObject({
        data: { page: 'https://typescript-eslint.io/rules/no-explicit-any' },
    });
    expect(explain(undefined, 'eslint/sonarjs/no-identical-functions')).toMatchObject({ data: { page: null } });
});

test.each([
    ['gspot/no-trivial-functions', 'https://gspot.dev/reference/plugin/no-trivial-functions/'],
    ['@typescript-eslint/no-explicit-any', 'https://typescript-eslint.io/rules/no-explicit-any'],
    [
        'unicorn/prefer-set-has',
        'https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-set-has.md',
    ],
])('raw plugin rule %s resolves its declared documentation', (subject, page) => {
    expect(explain(undefined, subject)).toMatchObject({ kind: 'tool-rule', data: { tool: 'eslint', page } });
});

test('check explanations add no absent metadata', () => {
    const format = explain(undefined, 'python/ruff-format');
    expect(format).toMatchObject({ kind: 'check', data: { configuration: 'python' } });
    expect(format).not.toHaveProperty('data.path_prefix');
});

test('an unknown raw rule namespace is refused with the requested subject', () => {
    expect(() => explain(undefined, 'unknown/no-such-rule')).toThrow('There is no check called `unknown/no-such-rule`');
    expect(explain(undefined, 'eslint/unknown/no-such-rule')).toMatchObject({
        kind: 'tool-rule',
        data: { tool: 'eslint', rule: 'unknown/no-such-rule', page: null },
    });
});
