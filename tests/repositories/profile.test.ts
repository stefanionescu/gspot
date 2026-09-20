// Planted repositories: a profile saved in one repository installs the same policy in another, and a bad one stops init.
import { join } from 'node:path';
import { createFixture } from 'fs-fixture';
import { describe, expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { commitAll, PLANTED_TIMEOUT_MS, run, script, toolsPath } from '#tests/harness/planted.ts';

const TOOLS = { PATH: toolsPath(['ast-grep', 'shellcheck', 'shfmt', 'typos']) };

async function tables(root: string): Promise<Record<string, unknown>> {
    return Bun.TOML.parse(await Bun.file(join(root, 'gspot.toml')).text()) as Record<string, unknown>;
}

function treeContents(root: string): Record<string, string> {
    return Object.fromEntries(
        readdirSync(root, { recursive: true }).map((entry) => {
            const path = String(entry);
            const full = join(root, path);
            const attributes = statSync(full);
            const bytes = attributes.isFile() ? readFileSync(full).toString('base64') : 'directory';
            return [path, `${String(attributes.mode)}:${bytes}`];
        }),
    );
}

describe('profiles', () => {
    test('init validates a profile in a dry run without changing the repository', async () => {
        await using fixture = await createFixture({
            'scripts/a.sh': script,
            'team.profile.toml': 'version = 1\nprofile = "team"\nselection = "exact"\npresets = ["bash"]\n',
        });
        commitAll(fixture.path);
        const before = treeContents(fixture.path);
        const result = run(fixture.path, ['init', '--yes', '--from', 'team.profile.toml', '--dry-run'], TOOLS);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        expect(result.stdout).toContain('profile    team');
        expect(result.stdout).toContain('--dry-run: nothing written');
        expect(treeContents(fixture.path)).toEqual(before);
        const removed = run(fixture.path, ['profile', 'check', 'team.profile.toml'], TOOLS);
        expect(removed.code).toBe(2);
        expect(removed.stderr).toContain("unknown command 'check'");
    });

    test(
        'profile save in one repository and init --from in another give the same tables',
        async () => {
            await using first = await createFixture({ 'scripts/a.sh': script });
            commitAll(first.path);
            run(
                first.path,
                [
                    'init',
                    '--yes',
                    '--presets',
                    'bash',
                    '--without',
                    'naming',
                    '--runner',
                    'none',
                    '--ci',
                    'none',
                    '--hooks',
                    'none',
                    '--no-install',
                ],
                TOOLS,
            );
            run(first.path, ['set', 'format.indent_width', '2'], TOOLS);
            run(
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
            const saved = run(first.path, ['profile', 'save', 'house.profile.toml'], TOOLS);
            expect(saved.code).toBe(0);
            expect(saved.stdout).toContain('left out  [[ignore]]: 1 entries');

            await using second = await createFixture({ 'tools/b.sh': script, 'index.ts': 'export const b = 1;\n' });
            commitAll(second.path);
            const from = join(first.path, 'house.profile.toml');
            const init = run(second.path, ['init', '--yes', '--from', from, '--no-install'], TOOLS);
            expect(init.stdout).toContain('profile    house');
            expect(init.stdout).toContain('detected, not in the profile: typescript');
            const [one, two] = [await tables(first.path), await tables(second.path)];
            expect(two['presets']).toEqual(one['presets']);
            expect(two['format']).toEqual({ indent_width: 2 });
            expect(two['hooks']).toEqual(one['hooks']);
            expect(two['ignore']).toBeUndefined();
        },
        PLANTED_TIMEOUT_MS,
    );

    test(
        'a profile with a wrong value, an unknown preset and a path stops init before anything is written',
        async () => {
            await using fixture = await createFixture({
                'scripts/a.sh': script,
                'bad.profile.toml':
                    'version = 1\nprofile = "bad"\nselection = "sometimes"\npresets = ["speling"]\n\n[[tools.typos.exclude]]\npaths = ["a/**"]\nreason = "A reason that says something."\n',
            });
            commitAll(fixture.path);
            const init = run(fixture.path, ['init', '--yes', '--from', 'bad.profile.toml'], TOOLS);
            expect(init.code).toBe(2);
            expect(init.stderr).toContain('selection');
            expect(init.stderr).toContain('Did you mean `spelling`');
            expect(init.stderr).toContain('a profile carries no path');
            expect(existsSync(join(fixture.path, 'gspot.toml'))).toBe(false);
            const preview = run(fixture.path, ['init', '--yes', '--from', 'bad.profile.toml', '--dry-run'], TOOLS);
            expect(preview.code).toBe(2);
            expect(preview.stderr).toContain('a profile carries no path');
        },
        PLANTED_TIMEOUT_MS,
    );
});

describe('policy edits', () => {
    test('removed dry-run flags are rejected before policy edits', async () => {
        await using fixture = await createFixture({
            'gspot.toml': 'version = 1\npresets = ["bash"]\n',
            'scripts/a.sh': script,
        });
        commitAll(fixture.path);
        const before = treeContents(fixture.path);
        const commands = [
            ['set', 'format.indent_width', '2', '--dry-run'],
            ['ignore', 'bash/shellcheck', '--reason', 'A deliberately unquoted argument.', '--dry-run'],
        ];
        for (const command of commands) {
            const result = run(fixture.path, command, TOOLS);
            expect(result.code).toBe(2);
            expect(result.stderr).toContain("unknown option '--dry-run'");
            expect(treeContents(fixture.path)).toEqual(before);
        }
    });

    test(
        'an item that carries its own reason needs no flag, and --reason fills an item that has none',
        async () => {
            await using fixture = await createFixture({ 'scripts/a.sh': script });
            commitAll(fixture.path);
            run(
                fixture.path,
                [
                    'init',
                    '--yes',
                    '--presets',
                    'bash',
                    '--without',
                    'naming',
                    '--runner',
                    'none',
                    '--ci',
                    'none',
                    '--hooks',
                    'none',
                    '--no-install',
                ],
                TOOLS,
            );
            const own = run(
                fixture.path,
                ['set', 'tools.typos.exclude', '{"paths":["a/**"],"reason":"Text in another language lives here."}'],
                TOOLS,
            );
            expect(own.code, own.stderr).toBe(0);
            const filled = run(
                fixture.path,
                [
                    'set',
                    'tools.typos.exclude',
                    '{"paths":["b/**"]}',
                    '--reason',
                    'Fixtures that hold typos on purpose.',
                ],
                TOOLS,
            );
            expect(filled.code, filled.stderr).toBe(0);
            const policy = await tables(fixture.path);
            const written = policy['tools'] as {
                typos: { exclude: { paths: string[]; reason: string }[] };
            };
            expect(written.typos.exclude.map((entry) => entry.reason)).toEqual([
                'Text in another language lives here.',
                'Fixtures that hold typos on purpose.',
            ]);
            expect(run(fixture.path, ['set', 'tools.typos.exclude', '{"paths":["c/**"]}'], TOOLS).code).not.toBe(0);
        },
        PLANTED_TIMEOUT_MS,
    );
});
