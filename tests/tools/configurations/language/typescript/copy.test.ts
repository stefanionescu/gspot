import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { planRun } from '#cli/planning/public.ts';
import { commitAll } from '#tests/harness/git.ts';
import { mkdir, symlink } from 'node:fs/promises';
import { tsc } from '#cli/checks/language/public.ts';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { installedModules } from '#tests/harness/environment.ts';
import { getTsconfigProject } from '#cli/parsers/packages/public.ts';
import { compilerFiles, compilerCopyInputs } from '#cli/checks/language/contracts.ts';
import { TYPESCRIPT_COPY_FILES } from '#tests/config/tools/configurations/language/typescript/copy.ts';

test.each(['recommended', 'all'] as const)(
    '%s reference builds retain imported declarations and inherited configs without sibling installations',
    async (level) => {
        await using sandbox = await testdir({
            ...TYPESCRIPT_COPY_FILES,
            'gspot.toml': buildPolicy(['typescript'], {
                level,
                tables: '[scope.app]\nconfigurations = ["typescript"]\n[scope.neighbor]\nconfigurations = ["typescript"]\n',
            }),
        });
        await mkdir(join(sandbox.path, 'node_modules/.bin'), { recursive: true });
        await symlink(join(installedModules, 'typescript'), join(sandbox.path, 'node_modules/typescript'), 'dir');
        await symlink('../typescript/bin/tsc', join(sandbox.path, 'node_modules/.bin/tsc'));
        commitAll(sandbox.path);
        const applied = await spawnGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const session = await openSession(sandbox.path);
        const planned = planRun(session, { stage: 'push', only: ['typescript/tsc'], skips: [] }).find(
            ({ scope }) => scope.scope.path === '',
        );
        if (planned === undefined) throw new Error('No root TypeScript reference check was planned.');
        const project = getTsconfigProject(
            session.root,
            '',
            planned.files.map(({ path }) => path),
            session.reads,
        );
        if (project === undefined) throw new Error('The authored TypeScript solution was not parsed.');
        const selected = compilerCopyInputs(
            session,
            planned,
            project.projects,
            compilerFiles(session, planned, project.projects),
        );
        expect(selected.paths).toContain('app/shared/value.d.ts');
        expect(selected.paths).toContain('config/base.json');
        expect(selected.paths).not.toContain('neighbor/source.ts');
        expect(selected.dependencies.map(({ path }) => path)).toStrictEqual(['node_modules']);
        const failed = await tsc(session, planned);
        expect(failed.status).toBe('failed');
        expect(failed.findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
            { file: 'app/src/main.ts', rule: 'TS2322' },
        ]);
        expect(await Bun.file(join(sandbox.path, 'app/src/main.ts')).text()).toBe(
            TYPESCRIPT_COPY_FILES['app/src/main.ts'],
        );
        expect(await Bun.file(join(sandbox.path, 'app/src/main.js')).exists()).toBe(false);
        expect(await Bun.file(join(sandbox.path, 'app/tsconfig.tsbuildinfo')).exists()).toBe(false);
        await Bun.write(
            join(sandbox.path, 'app/src/main.ts'),
            TYPESCRIPT_COPY_FILES['app/src/main.ts'].replace('"wrong"', '8080'),
        );
        const corrected = await spawnGspot(sandbox.path, ['check', '--only', 'typescript/tsc', '--json']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(1);
        expect(
            (JSON.parse(corrected.stdout) as RunReport).checks
                .flatMap(({ findings }) => findings)
                .map(({ file, rule }) => ({ file, rule })),
        ).toStrictEqual([{ file: 'neighbor/source.ts', rule: 'TS2322' }]);
    },
);
