import { test, expect } from 'bun:test';
import { iniSection } from '#cli/repository/configuration/ini.ts';
import { gixyRules } from '#cli/repository/configuration/gixy-rules.ts';
import { javascriptRules } from '#cli/repository/configuration/javascript-rules.ts';

test('INI selection retains exact section text and treats malformed headings as content', () => {
    const selected =
        '[tool] # selected\r\nkey = value\r\n[other] trailing text\r\n[]\r\n[tool:child]; nested\r\nvalue = 2\r';
    expect(iniSection(`[unrelated]\r\nvalue = 1\r\n${selected}\n[toolbox]\nvalue = 3\n`, 'tool')).toBe(selected);
    expect(iniSection('[toolbox]\nvalue = 3\n', 'tool')).toBeUndefined();
    expect(iniSection('[tool\nvalue = 3\n', 'tool')).toBeUndefined();
});

test('INI selection rejects duplicate selected headings and accepts repeated unrelated sections', () => {
    expect(() => iniSection('[tool:child]\nx = 1\n[other]\n[tool:child] ; repeated\nx = 2', 'tool')).toThrow(
        'Duplicate configuration section: tool:child',
    );
    expect(iniSection('[other]\n[other]\n[tool:child]\nx = 1\n', 'tool')).toBe('[tool:child]\nx = 1\n');
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
    expect(() => gixyRules('checks =\n')).toThrow('Gixy rule configuration contains an invalid option.');
    expect(() => gixyRules('checks = [ssrf]\n')).toThrow('Gixy check selectors must be comma-separated strings.');
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
