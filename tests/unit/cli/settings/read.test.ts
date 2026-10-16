import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { symlink } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { parseSettings } from '#cli/settings/read.ts';
import { openSession } from '#cli/commands/session.ts';
import { KEY_PATH_CASES } from '#tests/config/settings/errors.ts';
import { INVALID_RUNTIMES } from '#tests/config/eslint/overrides.ts';
import { rejection, textContaining } from '#tests/setup/matchers.ts';
import { settingsText, settingsErrors } from '#tests/setup/settings.ts';

test.each([...INVALID_RUNTIMES])('an invalid runtime %s names the setting', (runtime) => {
    const text = stringify({
        configurations: ['javascript'],
        tools: { eslint: { override: [{ paths: ['**/*.js'], runtime }] } },
    });
    expect(() => parseSettings(text)).toThrow('tools.eslint.override.0.runtime');
    expect(() => parseSettings(text)).toThrow('Invalid option');
});

test('an OSV ignore expiry cannot add a TOML table', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            configurations: ['dependencies'],
            ignore: [
                {
                    check: 'dependencies/osv',
                    rule: 'GHSA-example',
                    reason: 'Reviewed upstream.',
                    until: '2026-09-20\n[verbatim]\ninjected = true',
                },
            ],
        }),
    });
    expect(await rejection(openSession(sandbox.path))).toContain('ignore.0.until');
});

test.each([
    ...KEY_PATH_CASES,
    ...[
        {
            correction: ['paths = []', 'paths = ["src"]'] as const,
            where: ['tools.eslint.override.0.paths:'],
            source: 'paths = []\nrules = {eqeqeq = ["always"]}',
        },
        {
            correction: ['eqeqeq = 0', 'eqeqeq = ["always"]'] as const,
            where: ['tools.eslint.override.0.rules.eqeqeq:'],
            source: 'paths = ["src"]\nrules = {eqeqeq = 0}',
        },
        {
            correction: ['eqeqeq = true', 'eqeqeq = ["always"]'] as const,
            where: ['tools.eslint.override.0.rules.eqeqeq:'],
            source: 'paths = ["src"]\nrules = {eqeqeq = true}',
        },
        {
            correction: ['rulez', 'rules'] as const,
            where: ['[tools.eslint.override.0]: `rulez` is not a gspot.toml setting.'],
            source: 'paths = ["src"]\nrulez = {eqeqeq = ["always"]}',
        },
    ].map(({ source, correction, where }) => ({
        name: where.join(', '),
        text: settingsText(['javascript'], { rules: true, tables: `[[tools.eslint.override]]\n${source}\n` }),
        where,
        correction,
        messages: [],
    })),
])('an error names the key path of $name, and the fix clears it', ({ text, where, correction, messages }) => {
    const found = settingsErrors(text);
    expect(found.every((line) => where.some((path) => line.startsWith(`gspot.toml: ${path}`)))).toBe(true);
    for (const path of where) {
        expect(found.some((line) => line.startsWith(`gspot.toml: ${path}`))).toBe(true);
    }
    for (const message of messages) expect(found[0]).toContain(message);
    expect(settingsErrors(text.replace(correction[0], correction[1]))).toStrictEqual([]);
});

test.each(['\n', '\r\n'])(
    'a TOML syntax error names its line and does not copy the source: %j line endings',
    (newline: string) => {
        const invalid = ['# private fixture marker', 'configurations = ?', ''].join(newline);
        const found = settingsErrors(invalid);
        expect(found).toHaveLength(1);
        expect(found[0]).toMatch(/^gspot\.toml:2:\d+ is not valid TOML:/u);
        expect(found[0]).not.toContain('private fixture marker');
        expect(found[0]).not.toContain('\n');
        expect(settingsErrors(invalid.replace('configurations = ?', 'configurations = []'))).toStrictEqual([]);
    },
);

test('unknown configurations are refused where they are written, with a suggestion', () => {
    const errors = settingsErrors(
        settingsText(['bas', 'bash', 'bas'], {
            rules: true,
            tables: '[[scope]]\npath = "api"\nconfigurations = ["pythonn", "bas"]\n',
        }),
    );
    expect(errors).toStrictEqual([
        textContaining('gspot.toml: configurations.0: There is no configuration called `bas`.'),
        textContaining('gspot.toml: configurations.2: There is no configuration called `bas`.'),
        textContaining('gspot.toml: scope.0.configurations.0: There is no configuration called `pythonn`.'),
        textContaining('gspot.toml: scope.0.configurations.1: There is no configuration called `bas`.'),
    ]);
    expect(errors[0]).toContain('Did you mean');
    expect(errors[0]).toContain('`bash`');
    expect(errors[2]).toContain('`python`');
});

test('a scope path through a link to a folder outside the repository is refused', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'project/.keep': '', 'outside/nested/sentinel': 'unchanged' });
    const root = join(sandbox.path, 'project');
    await symlink('../outside', join(root, 'linked'));
    const found = settingsErrors(settingsText(['bash'], { rules: true, tables: '[[scope]]\npath = "linked"\n' }), root);
    expect(found).toHaveLength(1);
    expect(found[0]).toContain('linked is a link. gspot does not write through links.');
});
