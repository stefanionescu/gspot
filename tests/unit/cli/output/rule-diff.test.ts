import { expect, test } from 'bun:test';
import { ruleDiff } from '#cli/emit/rule-diff.ts';
import type { GeneratedFile } from '#cli/types/generation.ts';

test('Gixy previews retain final root selectors and keep plugin options outside the rule lists', () => {
    const file: GeneratedFile = {
        path: '.gspot/config/gixy.cfg',
        content: 'checks = ssrf, aliastraversal\nskips = ssrf\n',
        rulesPath: ['checks', 'skips'],
        kind: 'config',
        readOnly: true,
    };
    expect(
        ruleDiff(
            file,
            '; explanation\r\nchecks: aliastraversal, ssrf\r\nskips = aliastraversal\r\nskips = ssrf # retained\r\n[origins]\nhttps-only = true\n',
        ),
    ).toStrictEqual({ rules: [] });
    expect(ruleDiff(file, 'checks = ssrf\n')).toStrictEqual({
        rules: [
            { path: 'checks', added: ['aliastraversal'], removed: [], changed: [] },
            { path: 'skips', added: ['ssrf'], removed: [], changed: [] },
        ],
    });
    expect(ruleDiff(file, 'skips = [ssrf]\n')).toStrictEqual({
        ruleError: 'Rule comparison failed: Gixy check selectors must be comma-separated strings.',
    });
    expect(ruleDiff(file, '=\n')).toStrictEqual({
        ruleError: 'Rule comparison failed: Gixy rule configuration contains an invalid option.',
    });
});

test('record rule lists compare by ID and diagnose ambiguous duplicate IDs', () => {
    const file: GeneratedFile = {
        path: '.gspot/config/semgrep/example.yml',
        content: 'rules:\n  - id: first\n    pattern: eval(...)\n  - id: second\n    pattern: exec(...)\n',
        rulesPath: ['rules'],
        kind: 'config',
        readOnly: true,
    };
    expect(
        ruleDiff(file, 'rules:\n  - id: second\n    pattern: exec(...)\n  - id: first\n    pattern: eval(...)\n'),
    ).toStrictEqual({ rules: [] });
    expect(
        ruleDiff(file, 'rules:\n  - id: first\n    pattern: other(...)\n  - id: removed\n    pattern: exec(...)\n'),
    ).toStrictEqual({
        rules: [{ path: 'rules', added: ['second'], removed: ['removed'], changed: ['first'] }],
    });
    expect(ruleDiff(file, 'rules:\n  - id: first\n  - id: first\n')).toStrictEqual({
        ruleError: 'Rule comparison failed: Rule path rules contains duplicate ID first.',
    });
    expect(ruleDiff(file, 'rules:\n  - pattern: eval(...)\n')).toStrictEqual({
        ruleError: 'Rule comparison failed: Rule path rules must contain records with string IDs.',
    });
});

test('JavaScript comparison reads static exports and rejects executable rule values without running them', () => {
    const file: GeneratedFile = {
        path: '.gspot/config/commitlint.config.cjs',
        content: "module.exports = {rules: {'type-case': [2, 'always', 'lower-case']}};",
        rulesPath: ['rules'],
        kind: 'config',
        readOnly: true,
    };
    expect(ruleDiff(file, "export default {rules: {'type-case': [0]}};")).toStrictEqual({
        rules: [{ path: 'rules', added: [], removed: [], changed: ['type-case'] }],
    });
    expect(ruleDiff(file, file.content)).toStrictEqual({ rules: [] });
    expect(
        ruleDiff(file, "module.exports = {rules: (() => { throw new Error('Executed fixture'); })()};").ruleError,
    ).toContain('JSON5');
    expect(ruleDiff(file, `${file.content}\nthrow new Error('Executed fixture');`)).toStrictEqual({
        ruleError: 'Rule comparison failed: JavaScript rule comparison requires a single static configuration export.',
    });
});

test('Vale comparison combines style selections and keeps rule overrides in their file sections', () => {
    const file: GeneratedFile = {
        path: '.gspot/config/vale.ini',
        content: '[*]\nBasedOnStyles = Vale, Example\nExample.Rule = YES\n',
        rulesPath: ['*.rules', '*.BasedOnStyles'],
        kind: 'config',
        readOnly: true,
    };
    expect(
        ruleDiff(
            file,
            '[*]\nBasedOnStyles = Example\nBasedOnStyles = Vale\nExample.Rule = NO\nExample.Rule = YES\nExample.Rule = NO\n[*.md]\nExample.Rule = NO\n',
        ),
    ).toStrictEqual({ rules: [] });
    expect(ruleDiff(file, '[*]\nBasedOnStyles = Vale\nExample.Rule = "NO" # explanation\n')).toStrictEqual({
        rules: [
            { path: '*.rules', added: [], removed: [], changed: ['Example.Rule'] },
            { path: '*.BasedOnStyles', added: ['Example'], removed: [], changed: [] },
        ],
    });
    expect(ruleDiff(file, '[*\n')).toStrictEqual({ ruleError: 'Rule comparison failed: Unclosed Vale section on line 1.' });
});

test('SQLFluff comparison names excluded rules and changed rule options while ignoring list order', () => {
    const file: GeneratedFile = {
        path: '.gspot/config/sqlfluff.cfg',
        content:
            '[sqlfluff]\nexclude_rules = CP01, LT01\n[sqlfluff:rules:capitalisation.keywords]\ncapitalisation_policy = upper\n',
        rulesPath: ['sqlfluff.rules', 'sqlfluff.exclude_rules', 'sqlfluff:rules'],
        kind: 'config',
        readOnly: true,
    };
    expect(
        ruleDiff(
            file,
            '[sqlfluff]\nexclude_rules = LT01,\n    CP01\n; explanation\n[sqlfluff:rules:capitalisation.keywords]\ncapitalisation_policy=upper\n',
        ),
    ).toStrictEqual({ rules: [] });
    expect(
        ruleDiff(
            file,
            '[sqlfluff]\nexclude_rules=LT01\n[sqlfluff:rules:capitalisation.keywords]\ncapitalisation_policy=lower\n',
        ),
    ).toStrictEqual({
        rules: [
            { path: 'sqlfluff.exclude_rules', added: ['CP01'], removed: [], changed: [] },
            { path: 'sqlfluff:rules', added: [], removed: [], changed: ['capitalisation.keywords'] },
        ],
    });
    expect(ruleDiff(file, '[sqlfluff]\nexclude_rules=LT01\nexclude_rules=CP01\n')).toStrictEqual({
        ruleError: 'Rule comparison failed: Duplicate SQLFluff option on line 3.',
    });
    expect(ruleDiff(file, 'exclude_rules=CP01\n')).toStrictEqual({
        ruleError: 'Rule comparison failed: Invalid SQLFluff configuration on line 1.',
    });
});

test('SQLFluff comparison preserves case-sensitive options and resolves inherited defaults as data', () => {
    const file: GeneratedFile = {
        path: '.gspot/config/sqlfluff.cfg',
        content: '[sqlfluff:rules:example]\nflag = true\nlimit = 1\nName = VALUE\n',
        rulesPath: ['sqlfluff:rules'],
        kind: 'config',
        readOnly: true,
    };
    expect(ruleDiff(file, '[DEFAULT]\nflag = TRUE\nlimit = 1.0\n[sqlfluff:rules:example]\nName = VALUE\n')).toStrictEqual({
        rules: [],
    });
    expect(ruleDiff(file, file.content.replace('Name', 'name'))).toStrictEqual({
        rules: [{ path: 'sqlfluff:rules', added: [], removed: [], changed: ['example'] }],
    });
});

test.each([
    {
        path: 'rules.jsonc',
        before: '{"rules": {"first": true, "second": 2}}',
        after: '{"rules": {"second": 3, "third": true}}',
    },
    {
        path: 'rules.yml',
        before: 'rules:\n  first: true\n  second: 2\n',
        after: 'rules:\n  second: 3\n  third: true\n',
    },
    { path: 'rules.toml', before: '[rules]\nfirst = true\nsecond = 2\n', after: '[rules]\nsecond = 3\nthird = true\n' },
])('rule comparison describes additions, removals, and option changes in $path', ({ path, before, after }) => {
    const file: GeneratedFile = { path, content: after, rulesPath: ['rules'], kind: 'config', readOnly: true };
    expect(ruleDiff(file, before)).toStrictEqual({
        rules: [{ path: 'rules', added: ['third'], removed: ['first'], changed: ['second'] }],
    });
    expect(ruleDiff(file, after)).toStrictEqual({ rules: [] });
});

test('rule comparison ignores list order and reports malformed JSON without claiming additions', () => {
    const file: GeneratedFile = {
        path: 'rules.json',
        content: '{"rules":["first","second"]}',
        rulesPath: ['rules'],
        kind: 'config',
        readOnly: true,
    };
    expect(ruleDiff(file, '{ "rules": ["second", "first"] }')).toStrictEqual({ rules: [] });
    expect(ruleDiff(file, '{broken')).toStrictEqual({
        ruleError: 'Rule comparison failed: Rule configuration is not valid JSON.',
    });
});

test('ShellCheck comparisons combine repeated directives and normalize code prefixes and list order', () => {
    const file: GeneratedFile = {
        path: '.gspot/config/shellcheckrc',
        content: 'shell=bash\nenable=all\ndisable=SC2086,SC2002\n',
        rulesPath: ['enable', 'disable'],
        kind: 'config',
        readOnly: true,
    };
    expect(
        ruleDiff(
            file,
            '# example\r\nsource="path # literal"\r\nsource-path=path#literal\r\ndisable="2002" disable=2086 # reason\r\nenable=all\r\n',
        ),
    ).toStrictEqual({ rules: [] });
    expect(ruleDiff(file, 'disable=SC2086\ndisable=SC2046\n')).toStrictEqual({
        rules: [
            { path: 'enable', added: ['all'], removed: [], changed: [] },
            { path: 'disable', added: ['SC2002'], removed: ['SC2046'], changed: [] },
        ],
    });
    expect(ruleDiff(file, 'disable="SC2086')).toStrictEqual({
        ruleError: 'Rule comparison failed: Unterminated ShellCheck quote on line 1.',
    });
    expect(ruleDiff(file, 'disable=misspelled')).toStrictEqual({
        ruleError: 'Rule comparison failed: Invalid ShellCheck disable list on line 1.',
    });
});

test('SwiftFormat comparisons combine repeated and continued rule lists without treating options as rules', () => {
    const file: GeneratedFile = {
        path: '.gspot/config/swiftformat',
        content: '--enable consecutiveSpaces, trailingSpace\n--disable redundantSelf\n--indent 4\n',
        rulesPath: ['enable', 'disable', 'rules', 'lint-only'],
        kind: 'config',
        readOnly: true,
    };
    expect(
        ruleDiff(
            file,
            '--enable "trailingSpace" # explanation\r\n--enable consecutiveSpaces\r\n--disable redundantSelf\r\n--indent 2\r\n',
        ),
    ).toStrictEqual({ rules: [] });
    expect(
        ruleDiff(file, '--enable consecutiveSpaces,\\\n# continued list\n trailingSpace\n--disable redundantSelf\n'),
    ).toStrictEqual({ rules: [] });
    expect(ruleDiff(file, '--enable consecutiveSpaces\n--disable trailingSpace\n')).toStrictEqual({
        rules: [
            { path: 'enable', added: ['trailingSpace'], removed: [], changed: [] },
            { path: 'disable', added: ['redundantSelf'], removed: ['trailingSpace'], changed: [] },
        ],
    });
    expect(ruleDiff(file, '--enable "trailingSpace\n')).toStrictEqual({
        ruleError: 'Rule comparison failed: Invalid SwiftFormat enable list on line 1.',
    });
    expect(ruleDiff(file, '--filter **/Tests/**\n--disable trailingSpace\n')).toStrictEqual({
        ruleError:
            'Rule comparison failed: SwiftFormat rule comparison does not support configuration sections or filters.',
    });
});
