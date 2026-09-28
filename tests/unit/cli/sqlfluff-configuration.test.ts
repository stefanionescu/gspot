import { expect, test } from 'bun:test';
import { sqlfluffConfiguration, sqlfluffRules } from '#cli/repository/configuration/sqlfluff.ts';

test.each([
    { input: '12', expected: 12 },
    { input: '01', expected: 1 },
    { input: '-0', expected: -0 },
    { input: '+.5', expected: 0.5 },
    { input: '1.', expected: 1 },
    { input: '1E-2', expected: 0.01 },
    { input: '1e309', expected: '1e309' },
    { input: '0x10', expected: '0x10' },
    { input: '1..2', expected: '1..2' },
    { input: 'NaN', expected: 'NaN' },
    { input: 'Infinity', expected: 'Infinity' },
    { input: '', expected: '' },
    { input: 'TRUE', expected: true },
    { input: 'False', expected: false },
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

test.each([
    { text: '# comment\nvalue = first\n', message: 'Invalid SQLFluff configuration on line 2.' },
    { text: '[sqlfluff]\nbad\n    value = first\n', message: 'Invalid SQLFluff configuration on line 2.' },
    { text: '[sqlfluff]\n= first\n', message: 'Invalid SQLFluff configuration on line 2.' },
    { text: '[sqlfluff]\nvalue = first\n\nvalue = second\n', message: 'Duplicate SQLFluff option on line 4.' },
    { text: '[sqlfluff]\nvalue = first\n[sqlfluff]\n', message: 'Duplicate SQLFluff section on line 3.' },
])('SQLFluff reports the original physical line: $message', ({ text, message: description }) => {
    expect(() => sqlfluffConfiguration(text)).toThrow(description);
});

test('SQLFluff preserves the initial newline of an empty continued option', () => {
    const sections = sqlfluffConfiguration('[sqlfluff]\nvalue =\n    continued\n');
    expect(sections.get('sqlfluff')?.get('value')).toBe('\ncontinued\n');
});
