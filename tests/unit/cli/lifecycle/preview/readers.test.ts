import { test, expect } from 'bun:test';
import { getIniSection } from '#cli/kits/takeover.ts';
import { gixyRules } from '#cli/lifecycle/preview/gixy.ts';
import { javascriptRules } from '#cli/lifecycle/preview/javascript.ts';
import { sqlfluffRules, sqlfluffConfiguration } from '#cli/lifecycle/preview/sqlfluff.ts';

test('INI selection retains exact section text and treats malformed headings as content', () => {
    const selected =
        '[tool] # selected\r\nkey = value\r\n[other] trailing text\r\n[]\r\n[tool:child]; nested\r\nvalue = 2\r';
    expect(getIniSection(`[unrelated]\r\nvalue = 1\r\n${selected}\n[toolbox]\nvalue = 3\n`, 'tool')).toBe(selected);
    expect(getIniSection('[toolbox]\nvalue = 3\n', 'tool')).toBeUndefined();
    expect(getIniSection('[tool\nvalue = 3\n', 'tool')).toBeUndefined();
});

test('INI selection rejects duplicate selected headings and accepts repeated unrelated sections', () => {
    expect(() => getIniSection('[tool:child]\nx = 1\n[other]\n[tool:child] ; repeated\nx = 2', 'tool')).toThrow(
        'Duplicate configuration section: tool:child',
    );
    expect(getIniSection('[other]\n[other]\n[tool:child]\nx = 1\n', 'tool')).toBe('[tool:child]\nx = 1\n');
});

test('Gixy selection preserves root aliases, section-independent flags, and plugin boundaries', () => {
    expect(
        gixyRules(
            '# comment\n---\n--tests: ssrf, aliastraversal ; selected\n[plugin_name]\nchecks = ignored\n--skips\n',
        ),
    ).toStrictEqual({
        checks: ['ssrf', 'aliastraversal'],
        skips: ['true'],
    });
    expect(gixyRules('checks = ssrf\n')).toStrictEqual({ checks: ['ssrf'] });
});

test.each([
    'module["exports"] = {};',
    'module.exports += {};',
    'other.exports = {};',
    'module.exports.child = {};',
    'export = {};',
    'module.exports = () => ({});',
])('static JavaScript configuration refuses %s and accepts a literal export', (source) => {
    expect(() => javascriptRules('configuration.js', source)).toThrow(
        'JavaScript rule comparison requires a static object export.',
    );
    expect(javascriptRules('configuration.js', 'module.exports = {rules: {flag: false}};')).toStrictEqual({
        rules: { flag: false },
    });
    expect(javascriptRules('configuration.js', 'export default {rules: {flag: false}};')).toStrictEqual({
        rules: { flag: false },
    });
});

test.each([
    { input: '1E-2', expected: 0.01 },
    { input: '1e309', expected: '1e309' },
    { input: '0x10', expected: '0x10' },
    { input: 'TRUE', expected: true },
    { input: 'None', expected: null },
])('SQLFluff preserves the native value type for "$input"', ({ input, expected }) => {
    const rules = sqlfluffRules(`[sqlfluff:rules]\nvalue = ${input}\n`);
    expect(rules['sqlfluff:rules']).toStrictEqual({ value: expected });
});

test('SQLFluff continuation preserves blank lines, indented headings, and case-sensitive sections', () => {
    const sections = sqlfluffConfiguration(
        '\n# comment\n[SQLFluff]\nRule = first\n    [continued]\n\n; comment\n  last\nNext = final\n[sqlfluff] trailing\nrule = separate\n',
    );
    expect([...sections.keys()]).toStrictEqual(['SQLFluff', 'sqlfluff']);
    expect(Object.fromEntries(sections.get('SQLFluff')!)).toStrictEqual({
        Rule: 'first\n[continued]\n\nlast',
        Next: 'final',
    });
    expect(Object.fromEntries(sections.get('sqlfluff')!)).toStrictEqual({ rule: 'separate\n' });
});

test('SQLFluff refuses a repeated section on its original physical line', () => {
    expect(() => sqlfluffConfiguration('[sqlfluff]\nvalue = first\n[sqlfluff]\n')).toThrow(
        'Duplicate SQLFluff section on line 3.',
    );
});

test('SQLFluff preserves the initial newline of an empty continued option', () => {
    const sections = sqlfluffConfiguration('[sqlfluff]\nvalue =\n    continued\n');
    expect(sections.get('sqlfluff')?.get('value')).toBe('\ncontinued\n');
});
