import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { compareText } from '#cli/system/text.ts';
import { type Check } from '#cli/types/manifests.ts';
import { type Session } from '#cli/types/session.ts';
import { openSession } from '#cli/planning/session.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { runFixers } from '#cli/commands/check/fixes.ts';
import { GSPOT_FOLDER } from '#cli/config/files/gspot.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { isActive, planChecks } from '#cli/planning/checks.ts';
import { BASE_CHECK } from '#tests/config/runs/command/check.ts';
import { writeProgramCommand } from '#tests/setup/system/fakes.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { mkdir, unlink, readFile, appendFile } from 'node:fs/promises';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { runChecks, buildCheckSession } from '#cli/commands/check/run.ts';
import { readStagedPaths, readChangedPaths } from '#cli/repository/revisions/changes.ts';

import {
    TSC_PUSH_OPTIONS,
    LAST_FILE_CHANGES,
    TWO_SCOPES_SETTINGS,
    LOCKFILE_TRIGGER_NAMES,
    PROJECT_FINDING_MESSAGE,
} from '#tests/config/planning/files.ts';

async function replaceChildScopeChecks(session: Session): Promise<void> {
    if (await isOnDisk(join(session.root, '.git/info/exclude')))
        await appendFile(join(session.root, '.git/info/exclude'), '\n.gspot/mock-tsc*\n');
    await writeProgramCommand(
        session.root,
        `${GSPOT_FOLDER}/mock-tsc`,
        'fakes/tool',
        '--line',
        PROJECT_FINDING_MESSAGE,
        '--exit',
        '1',
    );
    const configuration = session.configurationsByName.get('typescript')!;
    const check: Check = {
        ...BASE_CHECK,
        id: 'typescript/tsc',
        stage: TSC_PUSH_OPTIONS.stage,
        runs: 'scope',
        cwd: 'root',
        command: [join(session.root, `${GSPOT_FOLDER}/mock-tsc`)],
        output: { format: 'lines' },
        files: configuration.files,
        fix: buildProgramCommand('fakes/tool', '--text', 'restored', '{scope}/source.ts'),
    };
    const fileCheck = { ...check, id: 'data-files/v8r', runs: 'files' as const };
    for (const scope of session.scopes) {
        if (scope.path !== '') scope.configurations = [{ ...configuration, tools: [], checks: [check, fileCheck] }];
    }
}

test.each(LAST_FILE_CHANGES)(
    `a %s of the last file of a project runs only that project's check with %s files`,
    async (operation, selection) => {
        await using sandbox = await testdir({
            'gspot.toml': TWO_SCOPES_SETTINGS,
            'api/source.ts': 'export {};\n',
            'web/kept.ts': 'export {};\n',
        });

        commitAll(sandbox.path);
        runGitStep(
            sandbox.path,
            operation === 'delete' ? ['rm', 'api/source.ts'] : ['mv', 'api/source.ts', 'web/source.ts'],
        );
        await mkdir(join(sandbox.path, 'api'), { recursive: true });
        const session = await openSession(sandbox.path);
        await replaceChildScopeChecks(session);
        const selected =
            selection === 'staged' ? await readStagedPaths(sandbox.path) : await readChangedPaths(sandbox.path, 'HEAD');
        const revision = 'staged' in selected ? { staged: selected.staged } : { changed: selected.paths };
        const planned = planChecks(session, { ...TSC_PUSH_OPTIONS, ...revision });
        const api = planned.find((check) => check.scope.path === 'api')!;
        expect(api.files).toStrictEqual([]);
        expect(api.triggerPaths).toStrictEqual(['api/source.ts']);
        const fileChecks = planChecks(session, { ...TSC_PUSH_OPTIONS, only: ['data-files/v8r'], ...revision });
        expect(fileChecks.flatMap((check) => check.triggerPaths)).toStrictEqual([]);
        expect(fileChecks.flatMap((check) => check.files.map((file) => file.path))).toStrictEqual(
            operation === 'delete' ? [] : ['web/source.ts'],
        );
        const result = await runChecks(session, buildRunOptions({ ...TSC_PUSH_OPTIONS, ...revision }));
        expect(result.report.exitCode).toBe(1);
        const active = result.report.checks.filter((check) => check.status !== 'skipped');
        expect(active.map((check) => check.scope)).toStrictEqual(operation === 'delete' ? ['api'] : ['api', 'web']);
        expect(active.map((check) => check.findings.map(({ message }) => message))).toStrictEqual(
            active.map(() => [PROJECT_FINDING_MESSAGE]),
        );
    },
);

test('a fixer of a deleted trigger path restores it', async () => {
    await using sandbox = await testdir({
        'gspot.toml': TWO_SCOPES_SETTINGS,
        'api/source.ts': 'export {};\n',
        'web/kept.ts': 'export {};\n',
    });
    commitAll(sandbox.path);
    runGitStep(sandbox.path, ['rm', 'api/source.ts']);
    await mkdir(join(sandbox.path, 'api'), { recursive: true });
    const session = await openSession(sandbox.path);
    await replaceChildScopeChecks(session);
    const { paths } = await readChangedPaths(sandbox.path, 'HEAD');
    const api = planChecks(session, { ...TSC_PUSH_OPTIONS, changed: paths }).find(
        (check) => check.scope.path === 'api',
    )!;
    const applied = await runFixers(buildCheckSession(session), [api]);
    expect(applied.changed).toStrictEqual(['api/source.ts']);
    expect(await readFile(join(sandbox.path, 'api/source.ts'), 'utf8')).toBe('restored');
});

test('a deleted file from another language does not trigger a TypeScript project', async () => {
    await using sandbox = await testdir({ 'gspot.toml': TWO_SCOPES_SETTINGS, 'api/kept.ts': 'export {};\n' });

    const session = await openSession(sandbox.path);
    await replaceChildScopeChecks(session);
    const planned = planChecks(session, {
        ...TSC_PUSH_OPTIONS,
        changed: ['api/removed.py'],
    });
    expect(planned.flatMap((check) => check.files)).toStrictEqual([]);
    expect(planned.flatMap((check) => check.triggerPaths)).toStrictEqual([]);
});

test(`deleting a file of a child scope runs only the child project's check`, async () => {
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
        ...TSC_PUSH_OPTIONS,
        changed: ['api/nested/removed.ts'],
    });
    expect(
        planned.filter((check) => check.triggerPaths.length > 0).map((check) => [check.scope.path, check.triggerPaths]),
    ).toStrictEqual([['api/nested', ['api/nested/removed.ts']]]);
    expect(planned.find((check) => check.scope.path === 'api')?.files).toStrictEqual([]);
});

test.each(['gspot.toml', getManifestTarget('docs', 'lychee.toml')])(
    'a change to %s re-runs docs/lychee in every scope and keeps its path ignores',
    async (path) => {
        await using sandbox = await testdir({
            'gspot.toml': `configurations = ["docs"]\n[[scope]]\npath = "api"\n\nconfigurations = ["docs"]\n[[ignore]]\ncheck = "docs/lychee"\npaths = ["api/ignored/**"]\nreason = "These pages are evaluated only after the documentation build."\n`,
            'README.md': '# Root\n',
            'api/guide.md': '# API\n',
            'api/ignored/guide.md': '# Built pages\n',
        });

        const session = await openSession(sandbox.path);
        const planned = planChecks(session, { stage: 'commit', staged: [path], only: ['docs/lychee'] });
        expect(
            planned.map((plannedCheck) => ({
                scope: plannedCheck.scope.path,
                files: plannedCheck.files.map((file) => file.path).toSorted(compareText),
            })),
        ).toStrictEqual([
            { scope: '', files: ['README.md'] },
            { scope: 'api', files: ['api/guide.md'] },
        ]);
    },
);

test('dependencies/osv-scanner runs only when a trigger file changes', async () => {
    await using sandbox = await testdir({
        ...Object.fromEntries(
            LOCKFILE_TRIGGER_NAMES.flatMap((filename) => [
                [filename, ''],
                ['app/' + filename, ''],
            ]),
        ),
        'ignored/uv.lock': '',
        'gspot.toml': buildSandboxSettings(['dependencies'], {
            level: 'all',
            tables: '[[ignore]]\ncheck = "dependencies/osv-scanner"\npaths = ["ignored/**"]\nreason = "This external project has its own installation."\n',
            scopes: [{ path: 'app', configurations: ['dependencies'] }],
        }),
        'package.json': '{"name":"root","private":true}\n',
        'bun.lock': 'Root lockfile.\n',
        'source.txt': 'Root source.\n',
        'app/package.json': '{"name":"child","private":true}\n',
        'app/source.txt': 'Child source.\n',
    });
    const session = await openSession(sandbox.path);
    const options = { stage: 'push' as const, only: ['dependencies/osv-scanner'] };
    const [scopeCheck] = planChecks(session, options);
    for (const prefix of ['', 'app/']) {
        for (const filename of LOCKFILE_TRIGGER_NAMES) {
            const [triggered] = planChecks(session, { ...options, staged: [prefix + filename] });
            expect(isActive(triggered!), prefix + filename).toBe(true);
            expect(triggered!.files).toStrictEqual(scopeCheck!.files);
        }
        const [unrelated] = planChecks(session, { ...options, staged: [prefix + 'source.txt'] });
        expect(isActive(unrelated!)).toBe(false);
    }
    expect(isActive(planChecks(session, { ...options, staged: ['ignored/uv.lock'] })[0]!)).toBe(false);
    expect(isActive(planChecks(session, { ...options, changed: ['source.txt'] })[0]!)).toBe(false);
    await unlink(join(sandbox.path, 'app/uv.lock'));
    const reopened = await openSession(sandbox.path);
    const [deleted] = planChecks(reopened, { ...options, staged: ['app/uv.lock'] });
    expect(deleted!.triggerPaths).toStrictEqual(['app/uv.lock']);
    expect(isActive(deleted!)).toBe(true);
    expect(isActive(planChecks(session, { ...options, staged: ['gspot.toml'] })[0]!)).toBe(true);
});
