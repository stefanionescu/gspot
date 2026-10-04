import { parse } from 'smol-toml';
import { test, expect } from 'bun:test';
import { buildPolicy } from '#tests/harness/policy.ts';
import { setKey, proposePolicy } from '#cli/policy/edit.ts';
import { policyIndent } from '#cli/policy/settings/known.ts';
import { wrapLongArrays } from '#cli/parsers/toml/layout.ts';
import { POLICY_LINE_WIDTH } from '#cli/config/parsers/toml.ts';
import { LONG_ARRAY } from '#tests/config/cli/parsers/toml/layout.ts';

test('an array past the width goes one item per line, each item as written, and reads back the same', () => {
    const wrapped = wrapLongArrays(LONG_ARRAY, { indent: policyIndent({}), width: POLICY_LINE_WIDTH });
    expect(wrapped.split('\n').every((line) => line.length <= 120)).toBe(true);
    expect(wrapped).toContain('words = [\n    {word = "term0", reason = "A product name, kept as spelled."},\n');
    expect(wrapped).toEndWith('kept as spelled."},\n]\n');
    expect(parse(wrapped)).toStrictEqual(parse(LONG_ARRAY));
});

test('a short array, an array already on several lines, and a nested array keep their layout', () => {
    const text = buildPolicy(['bash', 'typescript'], {
        tables: '[[ignore]]\ncheck = "bash/shellcheck"\npaths = [\n  "a.sh",\n]\n[tools.eslint]\nrestricted_imports = [{ name = "lodash", message = "Import one function at a time.", paths = ["src/**", "tests/**"] }]\n',
    });
    expect(wrapLongArrays(text, { indent: policyIndent({}), width: POLICY_LINE_WIDTH })).toBe(text);
    expect(wrapLongArrays(text, { indent: '  ', width: 40 })).toContain(
        '[[tools.eslint.restricted_imports]]\nname = "lodash"\nmessage = "Import one function at a time."',
    );
});

test('an array under a scope entry keeps the indentation of its key', () => {
    const names = Array.from({ length: 12 }, (_, index) => `"configuration-${String(index)}"`).join(', ');
    const text = `[[scope]]\npath = "api"\n  configurations = [${names}]\n`;
    const wrapped = wrapLongArrays(text, { indent: '\t', width: POLICY_LINE_WIDTH });
    expect(wrapped).toContain('  configurations = [\n  \t"configuration-0",\n');
    expect(wrapped).toContain('\n  ]\n');
});

test('the indentation follows the format table of the policy', () => {
    expect(policyIndent({ format: { indent_width: 2 } })).toBe('  ');
    expect(policyIndent({ format: { indent_style: 'tab' } })).toBe('\t');
    expect(policyIndent({})).toBe(' '.repeat(4));
});

test('oversized table lists retain comments, quoted keys, sibling values, and repeated scope ownership', () => {
    const reason =
        'This name is the exact spelling used by the external protocol and appears in these generated interfaces.';
    const text = `[[scope]]
path = "api"
[scope.tools.typos]
# Protocol vocabulary.
words = [
    # First spelling.
    {word = "Alpha", reason = "${reason}"}, # First entry.
    {word = "Beta", reason = "${reason}"},
] # Vocabulary end.
other = true
[scope.tools."quoted.name"]
values = [{name = "Gamma", reason = "${reason}"}]
[[scope]]
path = "web"
tools = {typos = {words = [{word = "Delta", reason = "${reason}"}], enabled = true}, empty = {}}
configurations = ["typescript"]
`;
    const output = wrapLongArrays(text, { indent: policyIndent({}), width: POLICY_LINE_WIDTH });
    expect(parse(output)).toStrictEqual(parse(text));
    expect(output).toContain('[[scope.tools.typos.words]]');
    expect(output).toContain('[[scope.tools."quoted.name".values]]');
    for (const comment of ['Protocol vocabulary.', 'First spelling.', 'First entry.', 'Vocabulary end.'])
        expect(output.split(`# ${comment}`)).toHaveLength(2);
    expect(wrapLongArrays(output, { indent: policyIndent({}), width: POLICY_LINE_WIDTH })).toBe(output);
});

test('root arrays and multiple lists retain following root assignments and table boundaries', () => {
    const entry = `{name = "${'a'.repeat(130)}", paths = ["first", "second"]}`;
    const text = `first = [${entry}]
second = [${entry}]
level = "all"
[tools]
flag = true
`;
    const output = wrapLongArrays(text, { indent: policyIndent({}), width: POLICY_LINE_WIDTH });
    expect(parse(output)).toStrictEqual(parse(text));
    expect(output).toContain('[[first]]');
    expect(output).toContain('[[second]]');
    expect(wrapLongArrays(output, { indent: policyIndent({}), width: POLICY_LINE_WIDTH })).toBe(output);
});

test('policy edits preserve expanded lists on a repeated write', () => {
    const reason = 'The generated client uses the exact product spelling in the protocol and every exported operation.';
    const original = `configurations = ["spelling"]
[tools.typos]
words = [{word = "Example", reason = "${reason}"}]
`;
    const first = proposePolicy(process.cwd(), original, (raw) => {
        setKey(raw, 'level', 'all');
    });
    expect(first.text).toContain('[[tools.typos.words]]');
    expect(
        proposePolicy(process.cwd(), first.text, (raw) => {
            setKey(raw, 'level', 'all');
        }).text,
    ).toBe(first.text);
    expect(parse(first.text)['tools']).toStrictEqual(parse(original)['tools']);
});
