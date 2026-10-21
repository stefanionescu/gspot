import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { fakeTool } from '#tests/setup/fakes.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { mkdir, readFile } from 'node:fs/promises';
import { planChecks } from '#cli/planning/checks.ts';
import { type Session } from '#cli/types/session.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { runFixers } from '#cli/commands/check/fixes.ts';
import { type Check } from '#cli/types/configurations.ts';
import { DOCS_SETTINGS } from '#tests/data/checks/docs.ts';
import { buildRunOptions } from '#tests/setup/builders.ts';
import { commitAll, readGitOutput } from '#tests/setup/git.ts';
import { BASE_CHECK } from '#tests/data/runs/command-checks.ts';
import { TWO_SCOPES_SETTINGS } from '#tests/data/settings/scopes.ts';
import { PROJECT_OPTIONS, PROJECT_TRIGGERS } from '#tests/data/runs/plan.ts';
import { readStagedPaths, readChangedPaths } from '#cli/repository/revisions/changes.ts';

/**
 * Put fake project and file checks into the child scopes of the session.
 *
 * @param session sandbox whose checks to replace.
 */
async function replaceChildScopeChecks(session: Session): Promise<void> {
    await fakeTool(session.root, '.gspot/mock-tsc', "console.log('Project finding'); process.exitCode = 1");
    const configuration = session.configurations.get('typescript')!;
    const check: Check = {
        ...BASE_CHECK,
        id: 'typescript/tsc',
        stage: PROJECT_OPTIONS.stage,
        runs: 'scope',
        cwd: 'root',
        command: [join(session.root, '.gspot/mock-tsc')],
        output: { format: 'lines' },
        files: configuration.files,
        fix: [process.execPath, '-e', "await Bun.write('{scope}/source.ts', 'restored')"],
    };
    const fileCheck = { ...check, id: 'data-files/v8r', runs: 'files' as const };
    for (const scope of session.scopes) {
        if (scope.folder.path !== '')
            scope.configurations = [{ ...configuration, tools: [], checks: [check, fileCheck] }];
    }
}

test.each([...PROJECT_TRIGGERS])(
    'a last-file %s triggers only the affected project with %s selection, and its fixer supports a dry run',
    async (operation, selection) => {
        await using sandbox = await testdir({
            'gspot.toml': TWO_SCOPES_SETTINGS,
            'api/source.ts': 'export {};\n',
            'web/kept.ts': 'export {};\n',
        });

        commitAll(sandbox.path);
        if (operation === 'delete') readGitOutput(sandbox.path, ['rm', 'api/source.ts']);
        else readGitOutput(sandbox.path, ['mv', 'api/source.ts', 'web/source.ts']);
        await mkdir(join(sandbox.path, 'api'), { recursive: true });
        const session = await openSession(sandbox.path);
        await replaceChildScopeChecks(session);
        const revision =
            selection === 'staged'
                ? await readStagedPaths(sandbox.path).then(({ staged }) => ({ staged }))
                : await readChangedPaths(sandbox.path, 'HEAD').then(({ paths }) => ({ changed: paths }));
        const planned = planChecks(session, { ...PROJECT_OPTIONS, ...revision });
        const api = planned.find((check) => check.scope.folder.path === 'api')!;
        expect(api.files).toStrictEqual([]);
        expect(api.triggerPaths).toContain('api/source.ts');
        const fileChecks = planChecks(session, { ...PROJECT_OPTIONS, only: ['data-files/v8r'], ...revision });
        expect(fileChecks.flatMap((check) => check.triggerPaths)).toStrictEqual([]);
        expect(fileChecks.flatMap((check) => check.files.map((file) => file.path))).toStrictEqual(
            operation === 'delete' ? [] : ['web/source.ts'],
        );
        const result = await runChecks(session, buildRunOptions({ ...PROJECT_OPTIONS, ...revision }));
        expect(result.report.exitCode).toBe(1);
        const active = result.report.checks.filter((check) => check.status !== 'skipped');
        expect(active.map((check) => check.scope)).toStrictEqual(operation === 'delete' ? ['api'] : ['api', 'web']);
        expect(active.map((check) => check.findings.map(({ message }) => message))).toStrictEqual(
            active.map(() => ['Project finding']),
        );
        const preview = await runFixers(session, [api], {
            isDryRun: true,
        });
        expect(preview.changed).toStrictEqual(['api/source.ts']);
        expect(await isOnDisk(join(sandbox.path, 'api/source.ts'))).toBe(false);
        const applied = await runFixers(session, [api], {
            isDryRun: false,
        });
        expect(applied.changed).toStrictEqual(['api/source.ts']);
        expect(await readFile(join(sandbox.path, 'api/source.ts'), 'utf8')).toBe('restored');
    },
);
test('a deleted file from another language does not trigger a TypeScript project', async () => {
    await using sandbox = await testdir({ 'gspot.toml': TWO_SCOPES_SETTINGS, 'api/kept.ts': 'export {};\n' });

    const session = await openSession(sandbox.path);
    await replaceChildScopeChecks(session);
    const planned = planChecks(session, {
        ...PROJECT_OPTIONS,
        changed: ['api/removed.py'],
    });
    expect(planned.flatMap((check) => check.files)).toStrictEqual([]);
    expect(planned.flatMap((check) => check.triggerPaths)).toStrictEqual([]);
});
test('a deleted child-scope input triggers only the child project', async () => {
    await using sandbox = await testdir({
        'gspot.toml':
            TWO_SCOPES_SETTINGS +
            `
[[scope]]
path = "api/nested"
configurations = []
`,
        'api/kept.ts': 'export {};\n',
        'api/nested/README.md': '# Nested\n',
        'web/kept.ts': 'export {};\n',
    });

    const session = await openSession(sandbox.path);
    await replaceChildScopeChecks(session);
    const planned = planChecks(session, {
        ...PROJECT_OPTIONS,
        changed: ['api/nested/removed.ts'],
    });
    expect(
        planned
            .filter((check) => check.triggerPaths.length > 0)
            .map((check) => [check.scope.folder.path, check.triggerPaths]),
    ).toStrictEqual([['api/nested', ['api/nested/removed.ts']]]);
    expect(planned.find((check) => check.scope.folder.path === 'api')?.files).toStrictEqual([]);
});
test.each(['gspot.toml', '.gspot/configurations/general/docs/lychee.toml'])(
    'a change to %s re-runs docs/lychee in every scope and keeps its path ignores',
    async (path) => {
        await using sandbox = await testdir({
            'gspot.toml': DOCS_SETTINGS,
            'README.md': '# Root\n',
            'api/guide.md': '# API\n',
            'api/ignored/guide.md': '# Built pages\n',
        });

        const session = await openSession(sandbox.path);
        const planned = planChecks(session, { stage: 'commit', staged: [path], only: ['docs/lychee'] });
        expect(
            planned.map((entry) => ({
                scope: entry.scope.folder.path,
                files: entry.files.map((file) => file.path).toSorted((left, right) => left.localeCompare(right)),
            })),
        ).toStrictEqual([
            { scope: '', files: ['README.md'] },
            { scope: 'api', files: ['api/guide.md'] },
        ]);
    },
);
