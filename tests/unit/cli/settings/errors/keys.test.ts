import { test, expect } from 'bun:test';
import { FIRST_READ } from '#cli/config/rules.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { UNKNOWN_KEY_CASES } from '#tests/config/settings/errors.ts';

test('a file path and a category folder are accepted', () => {
    expect(() =>
        parseSettings(
            '[rules]\nexclude = [".gspot/rules/general/engineering/code/ACCESSIBILITY.md", ".gspot/rules/library"]\n',
            undefined,
            createReadCache(process.cwd()),
        ),
    ).not.toThrow();
});

test('an entry that matches no rule file names the near match', () => {
    expect(() =>
        parseSettings(
            '[rules]\nexclude = [".gspot/rules/general/engineering/code/ACCESIBILITY.md"]\n',
            undefined,
            createReadCache(process.cwd()),
        ),
    ).toThrow('ACCESSIBILITY.md');
});

test.each([...FIRST_READ].slice(0, 1).concat('general/prose'))('a first-read entry %s cannot be left out', (entry) => {
    expect(() =>
        parseSettings(`[rules]\nexclude = [".gspot/rules/${entry}"]\n`, undefined, createReadCache(process.cwd())),
    ).toThrow('every agent opens first');
});

test('a role must be declared by a configuration selected in that scope or above', () => {
    expect(() =>
        parseSettings(
            'configurations = ["bash"]\n[architecture.roles]\nscripts = ["scripts/**"]\n',
            undefined,
            createReadCache(process.cwd()),
        ),
    ).toThrow('not declared by a selected configuration');
    expect(() =>
        parseSettings(
            'configurations = ["javascript"]\n[[scope]]\npath = "app"\narchitecture.roles.scripts = ["app/scripts/**"]\n',
            undefined,
            createReadCache(process.cwd()),
        ),
    ).not.toThrow();
    expect(() =>
        parseSettings(
            '[[scope]]\npath = "web"\nconfigurations = ["javascript"]\n[[scope]]\npath = "other"\narchitecture.roles.scripts = ["other/scripts/**"]\n',
            undefined,
            createReadCache(process.cwd()),
        ),
    ).toThrow('not declared by a selected configuration');
});

test('a limit looser than the default needs a reason, and a tighter one does not', () => {
    expect(() =>
        parseSettings(
            'configurations = ["bash"]\n[limits]\nfile_lines = 1000\n',
            undefined,
            createReadCache(process.cwd()),
        ),
    ).toThrow('reason');
    expect(() =>
        parseSettings(
            'configurations = ["bash"]\n[limits]\nfile_lines = 100\n',
            undefined,
            createReadCache(process.cwd()),
        ),
    ).not.toThrow();
});

test.each([...UNKNOWN_KEY_CASES])('an unknown key is refused: $name', (row) => {
    expect(() => parseSettings(row.text, undefined, createReadCache(process.cwd()))).toThrow(row.message);
    expect(() =>
        parseSettings(
            row.text.replace(row.correction[0], row.correction[1]),
            undefined,
            createReadCache(process.cwd()),
        ),
    ).not.toThrow();
});
