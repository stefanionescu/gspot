import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { writeOutputs } from '#cli/lifecycle/apply.ts';
import { cpSync, mkdirSync, symlinkSync } from 'node:fs';
import { getTsconfig } from '#cli/repository/tsconfig.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { installedModules } from '#tests/harness/environment.ts';

import {
    STANDALONE_CORRECTED_SOURCE,
    STANDALONE_TYPESCRIPT_FILES,
    STANDALONE_TYPESCRIPT_TABLES,
    STANDALONE_TYPESCRIPT_DIAGNOSTICS,
} from '#tests/config/tools/generation/standalone-typescript.ts';

test.skipIf(!isPosix).each(['recommended', 'all'] as const)(
    '%s standalone TypeScript checks its own scope and keeps project declarations without private globals',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...STANDALONE_TYPESCRIPT_FILES,
            'gspot.toml': buildPolicy(['typescript'], { level, tables: STANDALONE_TYPESCRIPT_TABLES }),
        });
        cpSync(join(installedModules, 'typescript'), join(sandbox.path, '.gspot/node_modules/typescript'), {
            recursive: true,
            dereference: true,
        });
        mkdirSync(join(sandbox.path, '.gspot/node_modules/.bin'));
        symlinkSync('../typescript/bin/tsc', join(sandbox.path, '.gspot/node_modules/.bin/tsc'));
        const session = await openSession(sandbox.path);
        using log = openOwnership(sandbox.path);
        writeOutputs(session, log);
        const rootConfig = getTsconfig(sandbox.path, join(sandbox.path, '.gspot/config/tsconfig.json'))!;
        const appConfig = getTsconfig(sandbox.path, join(sandbox.path, '.gspot/config/app/tsconfig.json'))!;
        expect(rootConfig.fileNames).toStrictEqual([join(sandbox.path, 'source.ts')]);
        expect(appConfig.fileNames).toStrictEqual([
            join(sandbox.path, 'app/ambient.d.ts'),
            join(sandbox.path, 'app/source.ts'),
        ]);
        const broken = await spawnGspot(sandbox.path, ['check', '--only', 'typescript/tsc', '--json']);
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        const report = JSON.parse(broken.stdout) as RunReport;
        expect(report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
            { scope: '', status: 'passed' },
            { scope: 'app', status: 'failed' },
        ]);
        expect(
            report.checks.flatMap(({ findings }) =>
                findings.map(({ file, line, column, rule, message }) => ({ file, line, column, rule, message })),
            ),
        ).toStrictEqual(STANDALONE_TYPESCRIPT_DIAGNOSTICS[level]);
        await Bun.write(join(sandbox.path, 'app/source.ts'), STANDALONE_CORRECTED_SOURCE);
        const corrected = await spawnGspot(sandbox.path, ['check', '--only', 'typescript/tsc', '--json']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(
            (JSON.parse(corrected.stdout) as RunReport).checks.map(({ scope, status, findings }) => ({
                scope,
                status,
                findings,
            })),
        ).toStrictEqual([
            { scope: '', status: 'passed', findings: [] },
            { scope: 'app', status: 'passed', findings: [] },
        ]);
        for (const path of [
            'app/ambient.d.ts',
            'app/emitted/generated.ts',
            'app/vendor/dependency.ts',
            '.gspot/node_modules/@types/private/index.d.ts',
        ] as const)
            expect(await Bun.file(join(sandbox.path, path)).text()).toBe(STANDALONE_TYPESCRIPT_FILES[path]);
    },
);
