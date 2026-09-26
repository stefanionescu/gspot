import { policyIndent, wrapLongArrays } from '#cli/policy/toml-width.ts';
import { expect, test } from 'bun:test';
import { parse } from 'smol-toml';

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
        'restricted_imports = [\n  { name = "lodash", message = "Import one function at a time.", paths = ["src/**", "tests/**"] },\n]',
    );
});

test('an array under a scope entry keeps the indentation of its key', () => {
    const text = `version = 1\n[[scope]]\npath = "api"\n  configurations = [${Array.from({ length: 12 }, (_, index) => `"configuration-${String(index)}"`).join(', ')}]\n`;
    const wrapped = wrapLongArrays(text, '\t');
    expect(wrapped).toContain('  configurations = [\n  \t"configuration-0",\n');
    expect(wrapped).toContain('\n  ]\n');
});

test('the indentation follows the format table of the policy', () => {
    expect(policyIndent({ format: { indent_width: 2 } })).toBe('  ');
    expect(policyIndent({ format: { indent_style: 'tab' } })).toBe('\t');
    expect(policyIndent({})).toBe('    ');
});
