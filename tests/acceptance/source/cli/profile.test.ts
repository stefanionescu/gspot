// Planted repositories: a profile saved in one repository installs the same policy in another, and a bad one stops init.
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { TYPO } from '#tests/support/spelling.ts';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { script } from '#tests/support/cli/planted.ts';
import { toolsPath } from '#tests/support/cli/tools.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/inputs/cli.ts';
import { treeContents } from '#tests/support/cli/preservation.ts';

const TOOLS = { PATH: toolsPath(['ast-grep', 'shellcheck', 'shfmt', 'typos']) };
// Export retains a pathless rule allowance and reports the repository-specific omission.
async function expectProfileExport(root: string): Promise<void> {
    await createFileTree(root, { 'scripts/a.sh': script });
    commitAll(root);
    await run(
        root,
        [
            'init',
            '--yes',
            '--kits',
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
    await run(root, ['set', 'format.indent_width', '2'], TOOLS);
    await run(
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
    const ignored = await run(
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
    const saved = await run(root, ['export', 'house.profile.toml'], TOOLS);
    expect(saved.code).toBe(0);
    expect(saved.stdout).toContain('left out  ignore[0]: names a repository path');
}

test('profiles > init validates a profile in a dry run without changing the repository', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'scripts/a.sh': script,
        'team.profile.toml': 'version = 1\nprofile = "team"\nselection = "exact"\nkits = ["bash"]\n',
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
    'profiles > export carries pathless ignores into a second repository',
    async () => {
        await using first = await testdir();
        await expectProfileExport(first.path);

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
        const [one, two] = [
            Bun.TOML.parse(await Bun.file(join(first.path, 'gspot.toml')).text()) as Record<string, unknown>,
            Bun.TOML.parse(await Bun.file(join(second.path, 'gspot.toml')).text()) as Record<string, unknown>,
        ];
        expect(two['kits']).toStrictEqual(one['kits']);
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
        // The profile's ignore covers the unused variable; nothing else in the script reports.
        await Bun.write(join(second.path, 'tools/b.sh'), '#!/usr/bin/env bash\nunused_variable=hello\n');
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
    'profiles > a profile with a wrong value, an unknown kit and a path stops init before anything is written',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'scripts/a.sh': script,
            'bad.profile.toml': `version = 1\nprofile = "bad"\nselection = "sometimes"\nkits = ["${TYPO.spelling}"]\n\n[[tools.typos.exclude]]\npaths = ["a/**"]\nreason = "A reason that says something."\n`,
        });
        commitAll(sandbox.path);
        const init = await run(sandbox.path, ['init', '--yes', '--from', 'bad.profile.toml'], TOOLS);
        expect(init.code).toBe(2);
        expect(init.stderr).toContain('selection');
        expect(init.stderr).toContain('Did you mean `spelling`');
        expect(init.stderr).toContain('a profile carries no path');
        expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(false);
        const preview = await run(sandbox.path, ['init', '--yes', '--from', 'bad.profile.toml', '--dry-run'], TOOLS);
        expect(preview.code).toBe(2);
        expect(preview.stderr).toContain('a profile carries no path');
        await Bun.write(
            join(sandbox.path, 'bad.profile.toml'),
            'version = 1\nprofile = "corrected"\nselection = "exact"\nkits = ["bash"]\n',
        );
        commitAll(sandbox.path);
        const corrected = await run(
            sandbox.path,
            ['init', '--yes', '--from', 'bad.profile.toml', '--no-install'],
            TOOLS,
        );
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        const read = Bun.TOML.parse(await Bun.file(join(sandbox.path, 'gspot.toml')).text()) as Record<string, unknown>;
        expect(read['kits']).toStrictEqual(['bash']);
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'policy edits > an item that carries its own reason needs no flag, and --reason fills an item that has none',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'scripts/a.sh': script });
        commitAll(sandbox.path);
        await run(
            sandbox.path,
            [
                'init',
                '--yes',
                '--kits',
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
            ['set', 'tools.typos.exclude', '{"paths":["b/**"]}', '--reason', 'Sandboxs that hold typos on purpose.'],
            TOOLS,
        );
        expect(filled.code, filled.stderr).toBe(0);
        const policy = Bun.TOML.parse(await Bun.file(join(sandbox.path, 'gspot.toml')).text()) as Record<
            string,
            unknown
        >;
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
