import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { writeOutputs } from '#cli/lifecycle/apply.ts';
import { cpSync, mkdirSync, symlinkSync } from 'node:fs';
import { workspaceRoot } from '#automation/workspace.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { JAVASCRIPT_PROJECT_FILES, JAVASCRIPT_COMPILER_CASES } from '#tests/config/tools/generation/jsconfig.ts';

for (const entry of JAVASCRIPT_COMPILER_CASES)
    test.skipIf(!isPosix).each(['recommended', 'all'] as const)(
        `%s JavaScript checks ${entry.name} and keeps authored inputs`,
        async (level) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                ...JAVASCRIPT_PROJECT_FILES,
                ...entry.files,
                'gspot.toml': buildPolicy(['javascript'], { level, tables: entry.tables }),
            });
            cpSync(
                join(workspaceRoot, '.gspot/node_modules/typescript'),
                join(sandbox.path, '.gspot/node_modules/typescript'),
                { recursive: true, dereference: true },
            );
            mkdirSync(join(sandbox.path, '.gspot/node_modules/.bin'));
            symlinkSync('../typescript/bin/tsc', join(sandbox.path, '.gspot/node_modules/.bin/tsc'));
            const session = await openSession(sandbox.path);
            using log = openOwnership(sandbox.path);
            writeOutputs(session, log);
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
            ).toStrictEqual(entry.diagnostics);
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
        },
    );
