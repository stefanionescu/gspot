import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { executeRun } from '#cli/execution/run.ts';
import { pathExists } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { fakeTool } from '#tests/setup/fake-tool.ts';
import { applyFixers } from '#cli/execution/fixes.ts';
import { type Session } from '#cli/types/planning.ts';
import { DOCS_SETTINGS } from '#tests/config/docs.ts';
import { openSession } from '#cli/commands/session.ts';
import { BASE_CHECK } from '#tests/config/execution.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/built-in.ts';
import { commitAll, gitOutput } from '#tests/setup/git.ts';
import { mkdir, unlink, readFile } from 'node:fs/promises';
import { planRun, isActive } from '#cli/planning/checks.ts';
import { buildRunOptions } from '#tests/setup/run-gspot.ts';
import { EDITORCONFIG_FILES } from '#tests/config/formatting.ts';
import { type CheckDeclaration } from '#cli/types/configurations.ts';
import { TWO_SCOPES_SETTINGS } from '#tests/config/settings/scopes.ts';
import { readStagedPaths, readChangedPaths } from '#cli/repository/revisions/changes.ts';
import { NEXT_BUILD_FILES, NEXT_BUILD_ROUTES, NEXT_BUILD_TABLES } from '#tests/config/nextjs.ts';

import {
    PROJECT_OPTIONS,
    PROJECT_TRIGGERS,
    PROJECT_PATH_IGNORES,
    LOCKFILE_TRIGGER_NAMES,
} from '#tests/config/planning.ts';

test.each([...PROJECT_TRIGGERS])(
    'a last-file %s triggers only the affected project with %s selection, and its fixer supports a dry run',
    async (operation, selection) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': TWO_SCOPES_SETTINGS,
            'api/source.ts': 'export {};\n',
            'web/kept.ts': 'export {};\n',
        });
        commitAll(sandbox.path);
        if (operation === 'delete') gitOutput(sandbox.path, ['rm', 'api/source.ts']);
        else gitOutput(sandbox.path, ['mv', 'api/source.ts', 'web/source.ts']);
        await mkdir(join(sandbox.path, 'api'), { recursive: true });
        const session = await openSession(sandbox.path);
        await projectChecks(session);
        const revision =
            selection === 'staged'
                ? await readStagedPaths(sandbox.path).then(({ staged }) => ({ staged }))
                : await readChangedPaths(sandbox.path, 'HEAD').then(({ paths }) => ({ changed: paths }));
        const planned = planRun(session, { ...PROJECT_OPTIONS, only: [...PROJECT_OPTIONS.only], ...revision });
        const api = planned.find((check) => check.scope.scope.path === 'api')!;
        expect(api.files).toStrictEqual([]);
        expect(api.triggerPaths).toContain('api/source.ts');
        const fileChecks = planRun(session, { ...PROJECT_OPTIONS, only: ['files/v8r'], ...revision });
        expect(fileChecks.flatMap((check) => check.triggerPaths)).toStrictEqual([]);
        expect(fileChecks.flatMap((check) => check.files.map((file) => file.path))).toStrictEqual(
            operation === 'delete' ? [] : ['web/source.ts'],
        );
        const outcome = await executeRun(
            session,
            buildRunOptions({ ...PROJECT_OPTIONS, only: [...PROJECT_OPTIONS.only], ...revision }),
        );
        expect(outcome.report.exitCode).toBe(1);
        expect(outcome.report.checks.map((check) => check.scope)).toStrictEqual(
            operation === 'delete' ? ['api'] : ['api', 'web'],
        );
        expect(outcome.report.checks.map((check) => check.findings.map(({ message }) => message))).toStrictEqual(
            outcome.report.checks.map(() => ['Project finding']),
        );
        const preview = await applyFixers(session, [api], { checks: BUILT_IN_CHECKS, isDryRun: true });
        expect(preview.changed).toStrictEqual(['api/source.ts']);
        expect(await pathExists(join(sandbox.path, 'api/source.ts'))).toBe(false);
        const applied = await applyFixers(session, [api], { checks: BUILT_IN_CHECKS, isDryRun: false });
        expect(applied.changed).toStrictEqual(['api/source.ts']);
        expect(await readFile(join(sandbox.path, 'api/source.ts'), 'utf8')).toBe('restored');
    },
);

test("a file named on the command line runs its scope's project check on every file of the scope", async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': TWO_SCOPES_SETTINGS,
        'api/source.ts': 'export {};\n',
        'api/caller.ts': 'export {};\n',
        'web/source.ts': 'export {};\n',
    });
    const session = await openSession(sandbox.path);
    await projectChecks(session);
    const planned = planRun(session, { ...PROJECT_OPTIONS, only: [...PROJECT_OPTIONS.only], paths: ['api/source.ts'] });
    const affected = planned.filter((check) => check.files.length > 0);
    expect(affected.map((check) => check.scope.scope.path)).toStrictEqual(['api']);
    expect(affected[0]?.files.map((file) => file.path)).toStrictEqual(['api/caller.ts', 'api/source.ts']);
    const outcome = await executeRun(
        session,
        buildRunOptions({ ...PROJECT_OPTIONS, only: [...PROJECT_OPTIONS.only], paths: ['api/source.ts'] }),
    );
    expect(outcome.report.exitCode).toBe(1);
    expect(outcome.report.checks[0]?.findings[0]?.message).toBe('Project finding');
});

test('a deleted file from another language does not trigger a TypeScript project', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': TWO_SCOPES_SETTINGS, 'api/kept.ts': 'export {};\n' });
    const session = await openSession(sandbox.path);
    await projectChecks(session);
    const planned = planRun(session, {
        ...PROJECT_OPTIONS,
        only: [...PROJECT_OPTIONS.only],
        changed: ['api/removed.py'],
    });
    expect(planned.flatMap((check) => check.files)).toStrictEqual([]);
    expect(planned.flatMap((check) => check.triggerPaths)).toStrictEqual([]);
});

test('a deleted child-scope input triggers only the child project', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
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
    await projectChecks(session);
    const planned = planRun(session, {
        ...PROJECT_OPTIONS,
        only: [...PROJECT_OPTIONS.only],
        changed: ['api/nested/removed.ts'],
    });
    expect(
        planned
            .filter((check) => check.triggerPaths.length > 0)
            .map((check) => [check.scope.scope.path, check.triggerPaths]),
    ).toStrictEqual([['api/nested', ['api/nested/removed.ts']]]);
    expect(planned.find((check) => check.scope.scope.path === 'api')?.files).toStrictEqual([]);
});

test.each([...PROJECT_PATH_IGNORES])(
    '$name keeps the project input selection',
    async ({ changed, present, check, rule, files }) => {
        await using sandbox = await testdir();
        const ruleField = rule === undefined ? '' : `rule = "${rule}"\n`;
        await createFileTree(sandbox.path, {
            'gspot.toml':
                TWO_SCOPES_SETTINGS +
                `
[[ignore]]
check = "${check}"
${ruleField}paths = ["api/ignored.ts"]
reason = "This input is evaluated by its owning pipeline."
`,
            'api/kept.ts': 'export {};\n',
            ...(present ? { 'api/ignored.ts': 'export {};\n' } : {}),
        });
        const session = await openSession(sandbox.path);
        await projectChecks(session);
        const planned = planRun(session, {
            ...PROJECT_OPTIONS,
            only: [...PROJECT_OPTIONS.only],
            changed: [...changed],
        });
        expect(planned.flatMap((entry) => entry.files.map((file) => file.path))).toStrictEqual([...files]);
        expect(planned.flatMap((entry) => entry.triggerPaths)).toStrictEqual([]);
    },
);

/**
 * Plant project and file checks on the real selected child scopes.
 * @param session the test-owned session whose selected checks to replace.
 */
async function projectChecks(session: Session): Promise<void> {
    await fakeTool(session.root, '.gspot/mock-tsc', "console.log('Project finding'); process.exitCode = 1");
    const manifest = session.manifests.get('typescript')!;
    const check: CheckDeclaration = {
        ...BASE_CHECK,
        name: 'typescript/tsc',
        runs: 'scope',
        cwd: 'root' as const,
        command: [join(session.root, '.gspot/mock-tsc')],
        output: { format: 'lines' as const },
        files: manifest.files,
        fix: [process.execPath, '-e', "await Bun.write('{scope}/source.ts', 'restored')"],
    };
    const fileCheck = { ...check, name: 'files/v8r', runs: 'files' as const };
    for (const scope of session.scopes) {
        if (scope.scope.path !== '') scope.selected = [{ ...manifest, tools: [], checks: [check, fileCheck] }];
    }
}

test('EditorConfig checks source files beyond the Prettier extensions and skips binary files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['format']),
        ...EDITORCONFIG_FILES,
        'binary.dat': Buffer.from([0, 255, 0]),
    });
    const session = await openSession(sandbox.path);
    const [planned] = planRun(session, { stage: 'commit', only: ['format/editorconfig-checker'] });
    expect(planned!.files.map(({ path }) => path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual(
        [...Object.keys(EDITORCONFIG_FILES), 'gspot.toml'].toSorted((left, right) => left.localeCompare(right)),
    );
    expect(planned!.skip).toBeUndefined();
});

test('dependencies/stale-lockfile runs only when a declared trigger file changes', async () => {
    await using sandbox = await testdir({
        ...Object.fromEntries(
            LOCKFILE_TRIGGER_NAMES.flatMap((filename) => [
                [filename, ''],
                ['app/' + filename, ''],
            ]),
        ),
        'ignored/package.json': '{"name":"ignored","private":true}\n',
        'gspot.toml': settingsText(['dependencies'], {
            level: 'all',
            tables: `[[ignore]]
check = "dependencies/stale-lockfile"
paths = ["ignored/**"]
reason = "This external project has its own installation."
[[scope]]
path = "app"
configurations = ["dependencies"]
`,
        }),
        'package.json': '{"name":"root","private":true}\n',
        'bun.lock': 'Root lockfile.\n',
        'source.txt': 'Root source.\n',
        'app/package.json': '{"name":"child","private":true}\n',
        'app/source.txt': 'Child source.\n',
    });
    const session = await openSession(sandbox.path);
    const options = { stage: 'push' as const, only: ['dependencies/stale-lockfile'] };
    const [whole] = planRun(session, options);
    for (const prefix of ['', 'app/']) {
        for (const filename of LOCKFILE_TRIGGER_NAMES) {
            const [triggered] = planRun(session, { ...options, staged: [prefix + filename] });
            expect(isActive(triggered!), prefix + filename).toBe(true);
            expect(triggered!.files).toStrictEqual(whole!.files);
        }
        const [unrelated] = planRun(session, { ...options, staged: [prefix + 'source.txt'] });
        expect(isActive(unrelated!)).toBe(false);
    }
    expect(isActive(planRun(session, { ...options, staged: ['ignored/package.json'] })[0]!)).toBe(false);
    expect(isActive(planRun(session, { ...options, changed: ['source.txt'] })[0]!)).toBe(false);
    await unlink(join(sandbox.path, 'app/uv.lock'));
    const reopened = await openSession(sandbox.path);
    const [deleted] = planRun(reopened, { ...options, staged: ['app/uv.lock'] });
    expect(deleted!.triggerPaths).toStrictEqual(['app/uv.lock']);
    expect(isActive(deleted!)).toBe(true);
    expect(isActive(planRun(session, { ...options, staged: ['gspot.toml'] })[0]!)).toBe(true);
});

test.each(['gspot.toml', '.gspot/config/lychee.toml'])(
    'a change to %s re-runs docs/lychee in every scope and keeps its path ignores',
    async (path) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': DOCS_SETTINGS,
            'README.md': '# Root\n',
            'api/guide.md': '# API\n',
            'api/ignored/guide.md': '# Built pages\n',
        });
        const session = await openSession(sandbox.path);
        const planned = planRun(session, { stage: 'commit', staged: [path], only: ['docs/lychee'] });
        expect(
            planned.map((entry) => ({
                scope: entry.scope.scope.path,
                files: entry.files.map((file) => file.path).toSorted((left, right) => left.localeCompare(right)),
            })),
        ).toStrictEqual([
            { scope: '', files: ['README.md'] },
            { scope: 'api', files: ['api/guide.md'] },
        ]);
    },
);

test.each([
    { level: 'recommended' as const, route: NEXT_BUILD_ROUTES[0] },
    ...NEXT_BUILD_ROUTES.map((route) => ({ level: 'all' as const, route })),
])(
    '$level plans nextjs/build for $route only in the app scope with all its project files',
    async ({ level, route }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['nextjs'], { level, tables: NEXT_BUILD_TABLES }),
            ...NEXT_BUILD_FILES,
            [`web/${route}`]: 'export default function Page() { return null; }\n',
        });
        const planned = planRun(await openSession(sandbox.path), {
            stage: 'push',
            only: ['nextjs/build'],
        });
        if (level === 'recommended') {
            expect(planned).toStrictEqual([]);
            return;
        }
        expect(planned.find((entry) => entry.scope.scope.path === '')).toMatchObject({
            files: [],
            triggerPaths: [],
        });
        const app = planned.find((entry) => entry.scope.scope.path === 'web');
        expect(app?.skip).toBeUndefined();
        expect(app?.files.map((file) => file.path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual(
            ['web/package.json', 'web/src/data.ts', 'web/tsconfig.json', `web/${route}`].toSorted((left, right) =>
                left.localeCompare(right),
            ),
        );
    },
);
