// Test repositories: a template saved in one repository installs the same policy in another, and a bad one stops init.
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildToolsPath } from '#tests/harness/install.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/samples/bash.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';

const TOOLS = { PATH: buildToolsPath(['ast-grep', 'shellcheck', 'shfmt', 'typos']) };
// Export retains a pathless rule allowance and reports the repository-specific omission.
async function expectTemplateExport(root: string): Promise<void> {
    await createFileTree(root, { 'scripts/a.sh': CLEAN_BASH_SCRIPT });
    commitAll(root);
    await spawnGspot(
        root,
        ['init', '--yes', '--configurations', 'bash', '--no-task', '--no-ci', '--no-hooks', '--no-install'],
        TOOLS,
    );
    await spawnGspot(root, ['set', 'format.indent_width', '2'], TOOLS);
    await spawnGspot(
        root,
        [
            'ignore',
            'bash/shellcheck',
            '--paths',
            'scripts/**',
            '--rule',
            'SC2086',
            '--reason',
            'A path entry that stays here.',
        ],
        TOOLS,
    );
    const ignored = await spawnGspot(
        root,
        [
            'ignore',
            'bash/shellcheck',
            '--rule',
            'SC2034',
            '--reason',
            'The shell exports these variables to another process.',
        ],
        TOOLS,
    );
    expect(ignored.code, ignored.stderr).toBe(0);
    const saved = await spawnGspot(root, ['export', 'house.template.toml'], TOOLS);
    expect(saved.code).toBe(0);
    expect(saved.stdout).toContain('left out  ignore[0]: names a repository path');
}

test(
    'templates > export carries pathless ignores into a second repository',
    async () => {
        await using first = await testdir();
        await expectTemplateExport(first.path);

        await using second = await testdir();
        await createFileTree(second.path, {
            'tools/b.sh': CLEAN_BASH_SCRIPT,
            'index.ts': 'export const b = 1;\n',
            '.shellcheckrc': 'disable=SC2154\n',
        });
        commitAll(second.path);
        const from = join(first.path, 'house.template.toml');
        const init = await spawnGspot(second.path, ['init', '--yes', '--from', from, '--no-install'], TOOLS);
        expect(init.stdout).toContain('template    house');
        expect(init.stdout).toContain('detected, not in the template: typescript');
        const [one, two] = [
            Bun.TOML.parse(await Bun.file(join(first.path, 'gspot.toml')).text()) as Record<string, unknown>,
            Bun.TOML.parse(await Bun.file(join(second.path, 'gspot.toml')).text()) as Record<string, unknown>,
        ];
        expect(two['configurations']).toStrictEqual(one['configurations']);
        expect(two['format']).toStrictEqual({ indent_width: 2 });
        expect(two['hooks']).toStrictEqual(one['hooks']);
        expect(two['ignore']).toStrictEqual([
            {
                check: 'bash/shellcheck',
                rule: 'SC2034',
                reason: 'The shell exports these variables to another process.',
            },
        ]);
        // The second repository's .shellcheckrc is deleted, not carried; the check names its configuration by path.
        expect(existsSync(join(second.path, '.shellcheckrc'))).toBe(false);
        // The template's ignore covers the unused variable; nothing else in the script reports.
        await Bun.write(join(second.path, 'tools/b.sh'), '#!/usr/bin/env bash\nunused_variable=hello\n');
        const checked = await spawnGspot(second.path, ['check', '--only', 'bash/shellcheck'], TOOLS);
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        await Bun.write(join(second.path, 'tools/b.sh'), '#!/usr/bin/env bash\necho $unquoted\n');
        const reported = await spawnGspot(second.path, ['check', '--only', 'bash/shellcheck'], TOOLS);
        expect(reported.code, reported.stdout + reported.stderr).toBe(1);
        expect(reported.stdout).toContain('SC2086');
    },
    NATIVE_TEST_TIMEOUT_MS,
);
