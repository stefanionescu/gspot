import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { run } from '#cli/platform/spawn.ts';
import { existsSync, readFileSync } from 'node:fs';
import { inspectTool } from '#cli/tools/inspect.ts';
import { kitManifests } from '#cli/kits/manifests.ts';
import { writeOutputs } from '#cli/lifecycle/write.ts';
import { openSession } from '#cli/execution/session.ts';
import { LOCKS } from '#tests/inputs/integration/tools/packages.ts';
import { runOwnedLifecycle } from '#cli/lifecycle/ownership/owner.ts';
import { installPackageProject } from '#cli/tools/packages/project.ts';
import { readPackageInputs, createPackageProject } from '#tests/support/cli/package-project.ts';

test.each((['npm', 'bun', 'pnpm', 'yarn'] as const).map((client) => [client, 'package.json', 'mise'] as const))(
    '%s clone installs immutable inputs twice and leaves its formatter ready',
    async (client, projectPath, runner) => {
        await using fixture = await createPackageProject(client, projectPath, runner);
        const { root, artifacts } = fixture;
        const tools = [...kitManifests().values()].flatMap((manifest) => manifest.tools);
        const first = await writeOutputs(await openSession(root));
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
            const installed = await runOwnedLifecycle(clone, (owner) => installPackageProject(clone, owner, tools));
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
        const prettier = tools.find((tool) => tool.name === 'prettier')!;
        expect(inspectTool({ root: clone, inspections: new Map() }, prettier).state).toBe('ok');
    },
    120_000,
);
