import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { run } from '#cli/platform/spawn.ts';
import { kitManifests } from '#cli/kits/manifests.ts';
import { openSession } from '#cli/execution/session.ts';
import { applyAll } from '#cli/commands/apply/workflow.ts';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { LOCKS } from '#tests/config/integration/tools/packages.ts';
import { installPackageProject } from '#cli/tools/packages/project.ts';
import { readPackageInputs, createPackageProject } from '#tests/support/cli/package-project.ts';

test.each((['npm', 'bun', 'pnpm', 'yarn'] as const).map((client) => [client, 'package.json', 'mise'] as const))(
    '%s clone installs immutable inputs twice and runs its installed formatter',
    async (client, projectPath, runner) => {
        await using fixture = await createPackageProject(client, projectPath, runner);
        const { root, artifacts } = fixture;
        const tools = [...kitManifests().values()].flatMap((manifest) => manifest.tools);
        const first = await applyAll(await openSession(root));
        expect(first.notes.filter((note) => note.startsWith('preserved'))).toStrictEqual([]);
        const { manifest, lock } = readPackageInputs(root, client);
        const clone = join(artifacts, 'clone');
        for (const argv of [
            ['git', 'add', '--all'],
            [
                'git',
                '-c',
                'user.name=Fixture',
                '-c',
                'user.email=fixture@example.com',
                '-c',
                'commit.gpgsign=false',
                'commit',
                '--quiet',
                '-m',
                'Fixture',
            ],
            ['git', 'clone', '--quiet', '--no-local', root, clone],
        ]) {
            const result = await run(argv, { cwd: root });
            expect(result.code, result.stdout + result.stderr).toBe(0);
        }
        expect(existsSync(join(clone, '.gspot/node_modules'))).toBe(false);
        expect(existsSync(join(clone, '.gspot/state/ownership.json'))).toBe(false);
        for (let attempt = 0; attempt < 2; attempt++) {
            const installed = await installPackageProject(clone, tools);
            expect(installed).toContain('.gspot/node_modules');
            const status = await run(['git', 'status', '--porcelain'], { cwd: clone });
            expect(status.code, status.stderr).toBe(0);
            expect(status.stdout).toBe('');
            // A Windows checkout may hold the lock with CRLF; the bytes are otherwise the committed ones.
            expect(readFileSync(join(clone, '.gspot', LOCKS[client]), 'utf8').replaceAll('\r\n', '\n')).toBe(
                lock.toString('utf8').replaceAll('\r\n', '\n'),
            );
            expect(readFileSync(join(clone, '.gspot/package.json'))).toStrictEqual(manifest);
        }
        const formatter = join(clone, '.gspot/node_modules/.bin/prettier');
        writeFileSync(join(clone, 'source.js'), 'export const greeting="hello";');
        const defect = await run([formatter, '--check', 'source.js'], { cwd: clone });
        expect(defect.code, defect.stdout + defect.stderr).toBe(1);
        const fixed = await run([formatter, '--write', 'source.js'], { cwd: clone });
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        const clean = await run([formatter, '--check', 'source.js'], { cwd: clone });
        expect(clean.code, clean.stdout + clean.stderr).toBe(0);
    },
    120_000,
);
