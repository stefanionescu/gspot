import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { script } from '#tests/support/cli/planted.ts';
import { toolsPath } from '#tests/support/cli/tools.ts';
import { containing } from '#tests/support/expectations.ts';
import { treeContents } from '#tests/support/cli/preservation.ts';
// Planted repositories: a profile saved in one repository installs the same policy in another, and a bad one stops init.
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';

const TOOLS = { PATH: toolsPath(['ast-grep', 'shellcheck', 'shfmt', 'typos']) };

async function tables(root: string): Promise<Record<string, unknown>> {
    return Bun.TOML.parse(await Bun.file(join(root, 'gspot.toml')).text()) as Record<string, unknown>;
}

describe('profiles', () => {
    test('init validates a profile in a dry run without changing the repository', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'scripts/a.sh': script,
            'team.profile.toml': 'version = 1\nprofile = "team"\nselection = "exact"\nconfigurations = ["bash"]\n',
        });
        commitAll(sandbox.path);
        const before = treeContents(sandbox.path);
        const result = await run(sandbox.path, ['init', '--yes', '--from', 'team.profile.toml', '--dry-run'], TOOLS);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        expect(result.stdout).toContain('profile    team');
        expect(result.stdout).toContain('--dry-run: nothing written');
        expect(treeContents(sandbox.path)).toStrictEqual(before);
    });

    test(
        'export carries pathless ignores into a second repository',
        async () => {
            await using first = await testdir();
            await createFileTree(first.path, { 'scripts/a.sh': script });
            commitAll(first.path);
            await run(
                first.path,
                [
                    'init',
                    '--yes',
                    '--configurations',
                    'bash',
                    '--without',
                    'naming',
                    '--no-runner',
                    '--no-ci',
                    '--no-hooks',
                    '--no-install',
                ],
                TOOLS,
            );
            await run(first.path, ['set', 'format.indent_width', '2'], TOOLS);
            await run(
                first.path,
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
            const ignored = await run(
                first.path,
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
            const saved = await run(first.path, ['export', 'house.profile.toml'], TOOLS);
            expect(saved.code).toBe(0);
            expect(saved.stdout).toContain('left out  ignore[0]: names a repository path');

            await using second = await testdir();
            await createFileTree(second.path, {
                'tools/b.sh': script,
                'index.ts': 'export const b = 1;\n',
                '.shellcheckrc': 'disable=SC2154\n',
            });
            commitAll(second.path);
            const from = join(first.path, 'house.profile.toml');
            const init = await run(second.path, ['init', '--yes', '--from', from, '--no-install'], TOOLS);
            expect(init.stdout).toContain('profile    house');
            expect(init.stdout).toContain('detected, not in the profile: typescript');
            const [one, two] = [await tables(first.path), await tables(second.path)];
            expect(two['configurations']).toStrictEqual(one['configurations']);
            expect(two['format']).toStrictEqual({ indent_width: 2 });
            expect(two['hooks']).toStrictEqual(one['hooks']);
            expect(two['ignore']).toStrictEqual([
                {
                    check: 'bash/shellcheck',
                    rule: 'SC2034',
                    reason: 'The shell exports these variables to another process.',
                },
                containing({ check: 'bash/shellcheck', rule: 'SC2154' }),
            ]);
            await Bun.write(
                join(second.path, 'tools/b.sh'),
                '#!/usr/bin/env bash\nunused_variable=hello\nprintf \'%s\\n\' "${exported_env}"\n',
            );
            const checked = await run(second.path, ['check', '--only', 'bash/shellcheck', '--no-cache'], TOOLS);
            expect(checked.code, checked.stdout + checked.stderr).toBe(0);
            await Bun.write(join(second.path, 'tools/b.sh'), '#!/usr/bin/env bash\necho $unquoted\n');
            const reported = await run(second.path, ['check', '--only', 'bash/shellcheck', '--no-cache'], TOOLS);
            expect(reported.code, reported.stdout + reported.stderr).toBe(1);
            expect(reported.stdout).toContain('SC2086');
        },
        PLANTED_TIMEOUT_MS,
    );

    test(
        'a profile with a wrong value, an unknown configuration and a path stops init before anything is written',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'scripts/a.sh': script,
                'bad.profile.toml':
                    'version = 1\nprofile = "bad"\nselection = "sometimes"\nconfigurations = ["speling"]\n\n[[tools.typos.exclude]]\npaths = ["a/**"]\nreason = "A reason that says something."\n',
            });
            commitAll(sandbox.path);
            const init = await run(sandbox.path, ['init', '--yes', '--from', 'bad.profile.toml'], TOOLS);
            expect(init.code).toBe(2);
            expect(init.stderr).toContain('selection');
            expect(init.stderr).toContain('Did you mean `spelling`');
            expect(init.stderr).toContain('a profile carries no path');
            expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(false);
            const preview = await run(
                sandbox.path,
                ['init', '--yes', '--from', 'bad.profile.toml', '--dry-run'],
                TOOLS,
            );
            expect(preview.code).toBe(2);
            expect(preview.stderr).toContain('a profile carries no path');
            await Bun.write(
                join(sandbox.path, 'bad.profile.toml'),
                'version = 1\nprofile = "corrected"\nselection = "exact"\nconfigurations = ["bash"]\n',
            );
            commitAll(sandbox.path);
            const corrected = await run(
                sandbox.path,
                ['init', '--yes', '--from', 'bad.profile.toml', '--no-install'],
                TOOLS,
            );
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect((await tables(sandbox.path))['configurations']).toStrictEqual(['bash']);
        },
        PLANTED_TIMEOUT_MS,
    );
});

describe('policy edits', () => {
    test(
        'an item that carries its own reason needs no flag, and --reason fills an item that has none',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'scripts/a.sh': script });
            commitAll(sandbox.path);
            await run(
                sandbox.path,
                [
                    'init',
                    '--yes',
                    '--configurations',
                    'bash',
                    '--without',
                    'naming',
                    '--no-runner',
                    '--no-ci',
                    '--no-hooks',
                    '--no-install',
                ],
                TOOLS,
            );
            const own = await run(
                sandbox.path,
                ['set', 'tools.typos.exclude', '{"paths":["a/**"],"reason":"Text in another language lives here."}'],
                TOOLS,
            );
            expect(own.code, own.stderr).toBe(0);
            const filled = await run(
                sandbox.path,
                [
                    'set',
                    'tools.typos.exclude',
                    '{"paths":["b/**"]}',
                    '--reason',
                    'Sandboxs that hold typos on purpose.',
                ],
                TOOLS,
            );
            expect(filled.code, filled.stderr).toBe(0);
            const policy = await tables(sandbox.path);
            const written = policy['tools'] as {
                typos: { exclude: { paths: string[]; reason: string }[] };
            };
            expect(written.typos.exclude.map((entry) => entry.reason)).toStrictEqual([
                'Text in another language lives here.',
                'Sandboxs that hold typos on purpose.',
            ]);
            const required = await run(sandbox.path, ['set', 'require_reasons', 'true'], TOOLS);
            expect(required.code, required.stdout + required.stderr).toBe(0);
            const invalid = await run(sandbox.path, ['set', 'tools.typos.exclude', '{"paths":["c/**"]}'], TOOLS);
            expect(invalid.code).toBe(2);
            const corrected = await run(
                sandbox.path,
                [
                    'set',
                    'tools.typos.exclude',
                    '{"paths":["c/**"]}',
                    '--reason',
                    'External fixtures preserve their source text.',
                ],
                TOOLS,
            );
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        },
        PLANTED_TIMEOUT_MS,
    );
});
