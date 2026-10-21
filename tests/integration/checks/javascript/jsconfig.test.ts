import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { DOT_GSPOT } from '#cli/config/gspot-paths.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { readFile, writeFile } from 'node:fs/promises';
import type { CheckResult } from '#cli/types/runs/check.ts';
import { buildSandboxChanges } from '#tests/setup/builders.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { NPM_BIN_FOLDER } from '#cli/config/tools/inspection.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { COMPILER_SOURCE } from '#tests/data/checks/typescript/projects.ts';
import { applySandboxChanges, registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { JSCONFIG_CASES, JSCONFIG_SANDBOX, JAVASCRIPT_PROJECT_FILES } from '#tests/data/checks/javascript/tsc.ts';

const installedSandbox = registerSharedSandbox(JSCONFIG_SANDBOX);

test("javascript/tsc uses gspot's own TypeScript when the project has none", async () => {
    const { root } = installedSandbox();
    const sourceFiles = {
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'source.js': COMPILER_SOURCE,
    };
    await using _sourceChange = await applySandboxChanges(
        installedSandbox(),
        buildSandboxChanges(JSCONFIG_SANDBOX.files, sourceFiles),
    );
    const broken = parseCheckReport(await spawnGspot(root, ['check', '--only', 'javascript/tsc', '--json']));
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    const report = broken.report;
    expect(report.checks).toMatchObject([
        {
            check: 'javascript/tsc',
            status: 'failed',
            findings: [
                {
                    file: 'source.js',
                    line: 1,
                    column: 22,
                    rule: 'TS2304',
                    message: "Cannot find name 'missing'.",
                    fixable: false,
                },
            ],
        },
    ]);
    expect(report.checks[0]!.command![0]).toBe(Bun.which('tsc', { PATH: join(root, DOT_GSPOT, NPM_BIN_FOLDER) })!);
    await writeFile(join(root, 'source.js'), 'export const value = 1;\n');
    const corrected = parseCheckReport(await spawnGspot(root, ['check', '--only', 'javascript/tsc', '--json']));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ check: 'javascript/tsc', status: 'passed', findings: [] }]);
});

test.each([...JSCONFIG_CASES])('javascript/tsc checks $name and keeps your files', async (entry) => {
    const level = 'all';
    const { root } = installedSandbox();
    const sourceFiles = {
        ...JAVASCRIPT_PROJECT_FILES,
        ...entry.files,
        'gspot.toml': buildSandboxSettings(['javascript'], { level, tables: entry.tables }),
    };
    await using _sourceChange = await applySandboxChanges(
        installedSandbox(),
        buildSandboxChanges(JSCONFIG_SANDBOX.files, sourceFiles),
    );
    await createFileTree(root, {
        '.gspot/node_modules/@types/private/index.d.ts':
            JAVASCRIPT_PROJECT_FILES['.gspot/node_modules/@types/private/index.d.ts'],
    });
    const command = ['check', '--only', 'javascript/tsc', '--json'];
    const broken = parseCheckReport(await spawnGspot(root, command));
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    const report = broken.report;
    expect(report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
        ...(entry.scope === '' ? [] : [{ scope: '', status: 'skipped' as const }]),
        { scope: entry.scope, status: 'failed' as const },
    ]);
    expect(report.checks.flatMap(({ findings }) => findings)).toStrictEqual(
        entry.diagnostics.map((finding) => matchFields(finding)),
    );
    await writeFile(join(root, entry.sourceFile), entry.correctedSource);
    const corrected = parseCheckReport(await spawnGspot(root, command));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toStrictEqual([
        ...(entry.scope === '' ? [] : [matchFields<CheckResult>({ scope: '', status: 'skipped', findings: [] })]),
        matchFields<CheckResult>({ scope: entry.scope, status: 'passed', findings: [] }),
    ]);
    for (const [path, original] of Object.entries({ ...JAVASCRIPT_PROJECT_FILES, ...entry.files }))
        if (path !== entry.sourceFile) expect(await readFile(join(root, path), 'utf8')).toBe(original);
});
