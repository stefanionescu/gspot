import { expect, test } from 'bun:test';
import { explain } from '#cli/commands/explain/subjects.ts';

test('a tool rule is explained with the page its manifest declares', () => {
    expect(explain(undefined, 'shellcheck/SC2086')).toMatchObject({
        kind: 'tool-rule',
        data: { tool: 'shellcheck', rule: 'SC2086', page: 'https://www.shellcheck.net/wiki/SC2086' },
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
    const undeclared = explain(undefined, 'eslint/sonarjs/no-identical-functions');
    expect(undeclared).toMatchObject({ data: { page: null } });
    expect('text' in undeclared ? undeclared.text : '').toContain("The tool's documentation has the page");
});

test('a check explanation shows the crash pattern of the tool it runs', () => {
    expect(explain(undefined, 'javascript/eslint')).toMatchObject({
        data: {
            tool_errors: '^(?:Oops! Something went wrong|Error: Cannot find module|ERR_MODULE_NOT_FOUND|ConfigError:)',
        },
    });
});
