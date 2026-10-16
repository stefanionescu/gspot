import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { openWriter } from '#cli/ownership/writer.ts';
import { openSession } from '#cli/commands/session.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { NPM_BIN_FOLDER } from '#cli/config/tools/find.ts';
import { DOT_GSPOT } from '#cli/config/system/locations.ts';
import { COMPILER_SOURCE } from '#tests/config/typescript.ts';
import { installToolProjects } from '#tests/setup/install.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { JSCONFIG_CASES, JAVASCRIPT_PROJECT_FILES } from '#tests/config/javascript.ts';

// The compiler passes after the source correction.

test("javascript/tsc uses gspot's own TypeScript when the project has none", async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'source.js': COMPILER_SOURCE,
    });
    await installToolProjects(sandbox.path);
    const session = await openSession(sandbox.path);
    using log = openWriter(sandbox.path);
    writeGeneratedFiles(session, emitAll(session), log);
    const broken = await spawnGspot(sandbox.path, ['check', '--only', 'javascript/tsc', '--json']);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    const report = JSON.parse(broken.stdout) as RunReport;
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
    const corrected = await spawnGspot(sandbox.path, ['check', '--only', 'javascript/tsc', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'javascript/tsc', status: 'passed', findings: [] },
    ]);
});

for (const entry of JSCONFIG_CASES)
    test(`javascript/tsc checks ${entry.name} and keeps your files`, async () => {
        const level = 'all';
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...JAVASCRIPT_PROJECT_FILES,
            ...entry.files,
            'gspot.toml': settingsText(['javascript'], { level, tables: entry.tables }),
        });
        await installToolProjects(sandbox.path);
        await createFileTree(sandbox.path, {
            '.gspot/node_modules/@types/private/index.d.ts':
                JAVASCRIPT_PROJECT_FILES['.gspot/node_modules/@types/private/index.d.ts'],
        });
        const session = await openSession(sandbox.path);
        using log = openWriter(sandbox.path);
        writeGeneratedFiles(session, emitAll(session), log);
        const command = ['check', '--only', 'javascript/tsc', '--json'];
        const broken = await spawnGspot(sandbox.path, command);
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        const report = JSON.parse(broken.stdout) as RunReport;
        expect(report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
            { scope: entry.scope, status: 'failed' },
        ]);
        expect(
            report.checks.flatMap(({ findings }) =>
                findings.map(({ file, line, column, rule, message }) => ({ file, line, column, rule, message })),
            ),
        ).toStrictEqual([...entry.diagnostics]);
        await Bun.write(join(sandbox.path, entry.sourceFile), entry.correctedSource);
        const corrected = await spawnGspot(sandbox.path, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(
            (JSON.parse(corrected.stdout) as RunReport).checks.map(({ scope, status, findings }) => ({
                scope,
                status,
                findings,
            })),
        ).toStrictEqual([{ scope: entry.scope, status: 'passed', findings: [] }]);
        for (const [path, original] of Object.entries({ ...JAVASCRIPT_PROJECT_FILES, ...entry.files }))
            if (path !== entry.sourceFile) expect(await Bun.file(join(sandbox.path, path)).text()).toBe(original);
    });
