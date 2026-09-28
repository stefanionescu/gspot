import { parse } from 'smol-toml';
import { test, expect } from 'bun:test';
import { setKey, proposePolicy } from '#cli/policy/write.ts';
import { policyIndent, wrapLongArrays } from '#cli/policy/toml/width.ts';

const WORDS = Array.from(
    { length: 6 },
    (_, index) => `{word = "term${String(index)}", reason = "A product name, kept as spelled."}`,
);
const LONG = `version = 1\n[tools.typos]\nwords = [${WORDS.join(', ')}]\n`;

test('an array past the width goes one item per line, each item as written, and reads back the same', () => {
    const wrapped = wrapLongArrays(LONG);
    expect(wrapped.split('\n').every((line) => line.length <= 120)).toBe(true);
    expect(wrapped).toContain('words = [\n    {word = "term0", reason = "A product name, kept as spelled."},\n');
    expect(wrapped).toEndWith('kept as spelled."},\n]\n');
    expect(parse(wrapped)).toStrictEqual(parse(LONG));
});

test('a short array, an array already on several lines, and a nested array keep their layout', () => {
    const text =
        'version = 1\nconfigurations = ["bash", "typescript"]\n[[ignore]]\ncheck = "bash/shellcheck"\npaths = [\n  "a.sh",\n]\n[tools.eslint]\nrestricted_imports = [{ name = "lodash", message = "Import one function at a time.", paths = ["src/**", "tests/**"] }]\n';
    expect(wrapLongArrays(text)).toBe(text);
    expect(wrapLongArrays(text, '  ', 40)).toContain(
        '[[tools.eslint.restricted_imports]]\nname = "lodash"\nmessage = "Import one function at a time."',
    );
});

test('an array under a scope entry keeps the indentation of its key', () => {
    const names = Array.from({ length: 12 }, (_, index) => `"configuration-${String(index)}"`).join(', ');
    const text = `version = 1\n[[scope]]\npath = "api"\n  configurations = [${names}]\n`;
    const wrapped = wrapLongArrays(text, '\t');
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
    const text = `version = 1
[[scope]]
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
    const output = wrapLongArrays(text);
    expect(parse(output)).toStrictEqual(parse(text));
    expect(output).toContain('[[scope.tools.typos.words]]');
    expect(output).toContain('[[scope.tools."quoted.name".values]]');
    for (const comment of ['Protocol vocabulary.', 'First spelling.', 'First entry.', 'Vocabulary end.'])
        expect(output.split(`# ${comment}`)).toHaveLength(2);
    expect(wrapLongArrays(output)).toBe(output);
});

test('root arrays and multiple lists retain following root assignments and table boundaries', () => {
    const entry = `{name = "${'a'.repeat(130)}", paths = ["first", "second"]}`;
    const text = `first = [${entry}]
second = [${entry}]
version = 1
[tools]
flag = true
`;
    const output = wrapLongArrays(text);
    expect(parse(output)).toStrictEqual(parse(text));
    expect(output).toContain('[[first]]');
    expect(output).toContain('[[second]]');
    expect(wrapLongArrays(output)).toBe(output);
});

test('policy edits preserve expanded lists on a repeated write', () => {
    const reason = 'The generated client uses the exact product spelling in the protocol and every exported operation.';
    const original = `version = 1
configurations = ["spelling"]
[tools.typos]
words = [{word = "Example", reason = "${reason}"}]
`;
    const first = proposePolicy(process.cwd(), original, setKey('level', 'all'));
    expect(first.text).toContain('[[tools.typos.words]]');
    expect(proposePolicy(process.cwd(), first.text, setKey('level', 'all')).text).toBe(first.text);
    expect(parse(first.text)['tools']).toStrictEqual(parse(original)['tools']);
});
