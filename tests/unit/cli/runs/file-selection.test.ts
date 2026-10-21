import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runChecks } from '#cli/runs/run.ts';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { unlink, writeFile } from 'node:fs/promises';
import { buildRunOptions } from '#tests/setup/builders.ts';
import { planRun, isActive } from '#cli/planning/checks.ts';
import { fakeTool, fakeNpmTool } from '#tests/setup/fakes.ts';
import { commitAll, readGitOutput } from '#tests/setup/git.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { EDITORCONFIG_FILES } from '#tests/data/checks/format.ts';
import { runGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';

import {
    PROJECT_OPTIONS,
    PROJECT_PATH_IGNORES,
    LOCKFILE_TRIGGER_NAMES,
    TYPESCRIPT_SCOPES_SETTINGS,
} from '#tests/data/runs/plan.ts';

/** Prepare a local TypeScript compiler that reports one project finding. */
async function prepareCompiler(root: string): Promise<void> {
    const declaration = await fakeNpmTool(root, 'tsc');
    await fakeTool(
        root,
        '.gspot/node_modules/.bin/tsc',
        `if (process.argv.includes('--version')) console.log(${JSON.stringify(declaration.version)}); else { console.log('source.ts(1,1): error TS2304: Project finding'); process.exitCode = 1; }`,
    );
}
test("a file named on the command line runs its scope's project check on every file of the scope", async () => {
    await using sandbox = await testdir({
        'gspot.toml': TYPESCRIPT_SCOPES_SETTINGS,
        'api/source.ts': 'export {};\n',
        'api/caller.ts': 'export {};\n',
        'api/tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'web/tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'web/source.ts': 'export {};\n',
    });

    await prepareCompiler(sandbox.path);
    const session = await openSession(sandbox.path);
    const planned = planRun(session, { ...PROJECT_OPTIONS, only: [...PROJECT_OPTIONS.only], paths: ['api/source.ts'] });
    const affected = planned.filter((check) => check.files.length > 0);
    expect(affected.map((check) => check.selection.scope.path)).toStrictEqual(['api']);
    expect(affected[0]?.files.map((file) => file.path)).toStrictEqual([
        'api/caller.ts',
        'api/source.ts',
        'api/tsconfig.json',
    ]);
    const result = await runChecks(
        session,
        buildRunOptions({ ...PROJECT_OPTIONS, only: [...PROJECT_OPTIONS.only], paths: ['api/source.ts'] }),
    );
    expect(result.report.exitCode, JSON.stringify(result.report)).toBe(1);
    expect(result.report.checks.find(({ scope }) => scope === 'api')?.findings[0]?.message).toBe('Project finding');
});
test.each([...PROJECT_PATH_IGNORES])(
    '$name keeps the project input selection',
    async ({ changed, present, check, rule, files }) => {
        await using sandbox = await testdir();
        const ruleField = rule === undefined ? '' : `rule = "${rule}"\n`;
        await createFileTree(sandbox.path, {
            'gspot.toml':
                TYPESCRIPT_SCOPES_SETTINGS +
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
        const planned = planRun(session, {
            ...PROJECT_OPTIONS,
            only: [...PROJECT_OPTIONS.only],
            changed: [...changed],
        });
        expect(planned.flatMap((entry) => entry.files.map((file) => file.path))).toStrictEqual([...files]);
        expect(planned.flatMap((entry) => entry.triggerPaths)).toStrictEqual([]);
    },
);
test('EditorConfig checks source files beyond the Prettier extensions and skips binary files', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['format']),
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
test('dependencies/osv-scanner runs only when a declared trigger file changes', async () => {
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
    expect(isActive(planRun(session, { ...options, staged: ['ignored/uv.lock'] })[0]!)).toBe(false);
    expect(isActive(planRun(session, { ...options, changed: ['source.txt'] })[0]!)).toBe(false);
    await unlink(join(sandbox.path, 'app/uv.lock'));
    const reopened = await openSession(sandbox.path);
    const [deleted] = planRun(reopened, { ...options, staged: ['app/uv.lock'] });
    expect(deleted!.triggerPaths).toStrictEqual(['app/uv.lock']);
    expect(isActive(deleted!)).toBe(true);
    expect(isActive(planRun(session, { ...options, staged: ['gspot.toml'] })[0]!)).toBe(true);
});

test('a project-wide TypeScript check counts source and configuration inputs without unrelated files', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript']),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'source.ts': 'export const value = 1;\n',
        ...Object.fromEntries(
            Array.from({ length: 20 }, (_, index) => [`notes-${String(index)}.txt`, 'Other input.\n']),
        ),
    });
    commitAll(sandbox.path);
    const declaration = await fakeNpmTool(sandbox.path, 'tsc');
    await fakeTool(
        sandbox.path,
        '.gspot/node_modules/.bin/tsc',
        `if (process.argv.includes('--version')) console.log(${JSON.stringify(declaration.version)});`,
    );
    const all = parseCheckReport(await runGspot(sandbox.path, ['check', '--only', 'typescript/tsc', '--json']));
    expect(all.code, all.stdout + all.stderr).toBe(0);
    expect(all.report.checks).toMatchObject([{ check: 'typescript/tsc', fileCount: 2 }]);
    await writeFile(join(sandbox.path, 'source.ts'), 'export const value = 2;\n');
    readGitOutput(sandbox.path, ['add', 'source.ts']);
    const staged = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--only', 'typescript/tsc', '--staged', '--json']),
    );
    expect(staged.code, staged.stdout + staged.stderr).toBe(0);
    expect(staged.report.checks).toMatchObject([{ check: 'typescript/tsc', fileCount: 2 }]);
});
