import { test, expect } from 'bun:test';
import { FIRST_READ } from '#cli/config/rules.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { UNKNOWN_KEY_CASES } from '#tests/config/settings/errors.ts';

test('a file path and a category folder are accepted', () => {
    expect(() =>
        parseSettings(
            '[rules]\nexclude = [".gspot/rules/general/engineering/code/ACCESSIBILITY.md", ".gspot/rules/library"]\n',
        ),
    ).not.toThrow();
});

test('an entry that matches no rule file names the near match', () => {
    expect(() =>
        parseSettings('[rules]\nexclude = [".gspot/rules/general/engineering/code/ACCESIBILITY.md"]\n'),
    ).toThrow('ACCESSIBILITY.md');
});

test.each([FIRST_READ[0], 'general/prose'])('a first-read entry %s cannot be left out', (entry) => {
    expect(() => parseSettings(`[rules]\nexclude = [".gspot/rules/${entry}"]\n`)).toThrow('every agent opens first');
});

test('a role must be declared by a configuration selected in that scope or above', () => {
    expect(() => parseSettings('configurations = ["bash"]\n[architecture.roles]\nscripts = ["scripts/**"]\n')).toThrow(
        'not declared by a selected configuration',
    );
    expect(() =>
        parseSettings(
            'configurations = ["javascript"]\n[[scope]]\npath = "app"\narchitecture.roles.scripts = ["app/scripts/**"]\n',
        ),
    ).not.toThrow();
    expect(() =>
        parseSettings(
            '[[scope]]\npath = "web"\nconfigurations = ["javascript"]\n[[scope]]\npath = "other"\narchitecture.roles.scripts = ["other/scripts/**"]\n',
        ),
    ).toThrow('not declared by a selected configuration');
});

test('a limit looser than the default needs a reason, and a tighter one does not', () => {
    expect(() => parseSettings('configurations = ["bash"]\n[limits]\nfile_lines = 1000\n')).toThrow('reason');
    expect(() => parseSettings('configurations = ["bash"]\n[limits]\nfile_lines = 100\n')).not.toThrow();
});

test.each([...UNKNOWN_KEY_CASES])('an unknown key is refused: $name', (row) => {
    expect(() => parseSettings(row.text)).toThrow(row.message);
    expect(() => parseSettings(row.text.replace(row.correction[0], row.correction[1]))).not.toThrow();
});
