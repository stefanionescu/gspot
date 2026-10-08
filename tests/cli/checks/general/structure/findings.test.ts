// Sandbox for the structure configuration: each repository-shape check fires on its sample.
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { git } from '#tests/harness/git.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { namingTerms } from '#cli/configurations/public.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import type { OwnedTestRepository } from '#tests/types/harness/repository.ts';
import { REPOSITORY } from '#tests/config/cli/checks/general/structure/findings.ts';
import { createTestRepository, prepareCliRepository } from '#tests/harness/repository.ts';

const resources = new AsyncDisposableStack();
let testRepository: OwnedTestRepository;
beforeAll(async () => {
    testRepository = resources.use(await createTestRepository(REPOSITORY, runGspot, prepareCliRepository));
});
afterAll(async () => {
    await resources.disposeAsync();
});

describe('the structure configuration', () => {
    test('structure/tracked-dependencies reports a dependency folder that git tracks', async () => {
        const { root, environment } = testRepository;
        const command = ['check', '--only', 'structure/tracked-dependencies', '--json'];
        const clean = await runGspot(root, command, environment);
        expect(clean.code, clean.stdout + clean.stderr).toBe(0);
        await mkdir(join(root, 'web', 'node_modules', 'left-pad'), { recursive: true });
        await Bun.write(join(root, 'web', 'node_modules', 'left-pad', 'index.js'), 'module.exports = 1;\n');
        expect(git(root, ['add', '-f', 'web/node_modules/left-pad/index.js']).code).toBe(0);
        const tracked = await runGspot(root, command, environment);
        expect(tracked.code).toBe(1);
        expect((JSON.parse(tracked.stdout) as RunReport).checks).toMatchObject([
            {
                check: 'structure/tracked-dependencies',
                status: 'failed',
                findings: [{ file: 'web/node_modules', rule: 'tracked-folder', line: 1 }],
            },
        ]);
        expect(git(root, ['rm', '-r', '--cached', '--quiet', 'web/node_modules']).code).toBe(0);
        const corrected = await runGspot(root, command, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: 'structure/tracked-dependencies', status: 'passed', findings: [] },
        ]);
    });
});

test.each(['recommended', 'all'] as const)(
    '%s folder bans come from the required naming group and accept an exact reasoned ignore',
    async (level) => {
        await using sandbox = await testdir();
        const folders = namingTerms().groups.folders.terms;
        const paths = folders.flatMap((folder) => [`${folder}/first.js`, `app/${folder}/first.js`]);
        const policy = buildPolicy(['javascript'], {
            level,
            tables: '[scope.app]\n[scope."app/worker"]\n',
        });
        await createFileTree(sandbox.path, {
            'gspot.toml': policy,
            ...Object.fromEntries(
                [...paths, 'shared/second.js', 'python/entry.js', 'app/worker/shared/entry.js'].map((path) => [
                    path,
                    'export const active = true;\n',
                ]),
            ),
        });
        const command = ['check', '--only', 'structure/folder-names', '--json'];
        const failed = await runGspot(sandbox.path, command);
        expect(failed.code, failed.stdout + failed.stderr).toBe(level === 'all' ? 1 : 0);
        const findings = (JSON.parse(failed.stdout) as RunReport).checks.flatMap(({ findings }) => findings);
        expect(findings.map(({ file }) => file).toSorted((left, right) => left.localeCompare(right))).toStrictEqual(
            level === 'all'
                ? [...paths, 'app/worker/shared/entry.js'].toSorted((left, right) => left.localeCompare(right))
                : [],
        );
        const ignored = await runGspot(sandbox.path, [
            'ignore',
            'structure/folder-names',
            '--paths',
            'shared/**',
            '--reason',
            'The existing public shared folder remains part of the project layout.',
        ]);
        expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
        const checked = await runGspot(sandbox.path, command);
        const remaining = (JSON.parse(checked.stdout) as RunReport).checks.flatMap(({ findings }) => findings);
        expect(remaining.map(({ file }) => file).toSorted((left, right) => left.localeCompare(right))).toStrictEqual(
            level === 'all'
                ? [...paths.filter((path) => !path.startsWith('shared/')), 'app/worker/shared/entry.js'].toSorted(
                      (left, right) => left.localeCompare(right),
                  )
                : [],
        );
        expect(await Bun.file(join(sandbox.path, 'shared/first.js')).text()).toBe('export const active = true;\n');
    },
);
