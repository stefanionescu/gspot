import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { matchFields } from '#tests/setup/matchers.ts';
import { NPM_BIN_FOLDER } from '#cli/config/tools/find.ts';
import { DOT_GSPOT } from '#cli/config/system/locations.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { buildSandboxChanges } from '#tests/setup/builders.ts';
import type { CheckResult } from '#cli/types/checks/run/check.ts';
import { spawnGspot, spawnCheckReport } from '#tests/setup/run-gspot.ts';
import { COMPILER_SOURCE } from '#tests/data/checks/typescript/projects.ts';
import { updateSandbox, registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { JSCONFIG_CASES, JSCONFIG_SANDBOX, JAVASCRIPT_PROJECT_FILES } from '#tests/data/checks/javascript/tsc.ts';

const installedSandbox = registerSharedSandbox(JSCONFIG_SANDBOX);

// The compiler passes after the source correction.

test("javascript/tsc uses gspot's own TypeScript when the project has none", async () => {
    const sandbox = { path: installedSandbox().root };
    const sourceFiles = {
        'gspot.toml': buildSettingsText(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'source.js': COMPILER_SOURCE,
    };
    await using _sourceChange = await updateSandbox(
        installedSandbox(),
        buildSandboxChanges(JSCONFIG_SANDBOX.files, sourceFiles),
    );
    expect(await spawnGspot(sandbox.path, ['apply'])).toMatchObject({ code: 0 });
    const broken = await spawnCheckReport(sandbox.path, ['check', '--only', 'javascript/tsc', '--json']);
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
    expect(report.checks[0]!.command![0]).toBe(
        Bun.which('tsc', { PATH: join(sandbox.path, DOT_GSPOT, NPM_BIN_FOLDER) })!,
    );
    await Bun.write(join(sandbox.path, 'source.js'), 'export const value = 1;\n');
    const corrected = await spawnCheckReport(sandbox.path, ['check', '--only', 'javascript/tsc', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ check: 'javascript/tsc', status: 'passed', findings: [] }]);
});

test.each([...JSCONFIG_CASES])('javascript/tsc checks $name and keeps your files', async (entry) => {
    const level = 'all';
    const sandbox = { path: installedSandbox().root };
    const sourceFiles = {
        ...JAVASCRIPT_PROJECT_FILES,
        ...entry.files,
        'gspot.toml': buildSettingsText(['javascript'], { level, tables: entry.tables }),
    };
    await using _sourceChange = await updateSandbox(
        installedSandbox(),
        buildSandboxChanges(JSCONFIG_SANDBOX.files, sourceFiles),
    );
    expect(await spawnGspot(sandbox.path, ['apply'])).toMatchObject({ code: 0 });
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/@types/private/index.d.ts':
            JAVASCRIPT_PROJECT_FILES['.gspot/node_modules/@types/private/index.d.ts'],
    });
    expect(await spawnGspot(sandbox.path, ['apply'])).toMatchObject({ code: 0 });
    const command = ['check', '--only', 'javascript/tsc', '--json'];
    const broken = await spawnCheckReport(sandbox.path, command);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    const report = broken.report;
    expect(report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
        ...(entry.scope === '' ? [] : [{ scope: '', status: 'skipped' as const }]),
        { scope: entry.scope, status: 'failed' as const },
    ]);
    expect(report.checks.flatMap(({ findings }) => findings)).toStrictEqual(
        entry.diagnostics.map((finding) => matchFields(finding)),
    );
    await Bun.write(join(sandbox.path, entry.sourceFile), entry.correctedSource);
    const corrected = await spawnCheckReport(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toStrictEqual([
        ...(entry.scope === '' ? [] : [matchFields<CheckResult>({ scope: '', status: 'skipped', findings: [] })]),
        matchFields<CheckResult>({ scope: entry.scope, status: 'passed', findings: [] }),
    ]);
    for (const [path, original] of Object.entries({ ...JAVASCRIPT_PROJECT_FILES, ...entry.files }))
        if (path !== entry.sourceFile) expect(await Bun.file(join(sandbox.path, path)).text()).toBe(original);
});
