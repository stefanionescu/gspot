import executables from 'which';
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { toPosix } from '#cli/platform/paths.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { scopeInput } from '#tests/harness/cli/input.ts';
import { rejection } from '#tests/harness/expectations.ts';
import type { EngineInput } from '#cli/types/execution/execution.ts';
import { statSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { nextjsBuild, nextjsTypes } from '#cli/checks/framework/nextjs/build.ts';
import { prepareNextjsBuild, readNextjsCommands } from '#tests/harness/cli/nextjs.ts';

for (const scope of ['', 'apps/web'])
    for (const check of ['nextjs/tsc', 'nextjs/build'])
        test(`Next.js output preservation in ${scope || 'root'}: ${check} reports a defect, accepts its correction, and preserves source output`, async () => {
            await using directory = await testdir();
            const input = await prepareNextjsBuild(directory.path, scope, check);
            const untracked = join(directory.path, join(scope, '.next/local-cache.bin'));
            const config = join(directory.path, join(scope, 'tsconfig.json'));
            const original = readFileSync(config);
            const mode = statSync(config).mode;
            using read = readNextjsCommands(check);
            const { directories, inspections, routesSeen } = read;
            const execute = check === 'nextjs/tsc' ? nextjsTypes : nextjsBuild;
            const found = await execute(input);
            expect(found).toHaveLength(1);
            expect(found[0]).toMatchObject({
                check,
                file: toPosix(join(scope, check === 'nextjs/tsc' ? 'src/page.ts' : 'package.json')),
                line: 1,
            });
            expect(found[0]!.message).toBe(
                check === 'nextjs/tsc' ? 'Type mismatch' : 'next build failed: Error: Page is invalid',
            );
            writeFileSync(join(directory.path, join(scope, 'src/page.ts')), 'corrected input\n');
            expect(await execute(input)).toStrictEqual([]);
            expect(directories).toHaveLength(check === 'nextjs/tsc' ? 4 : 2);
            expect(directories).not.toContain(join(directory.path, scope));
            expect(inspections.every((args) => args.length === 1 && args[0] === '--version')).toBe(true);
            expect(routesSeen.every((text) => text === '// Generated routes\n')).toBe(true);
            expect(directories.every((cwd) => !existsSync(cwd))).toBe(true);
            expect(readFileSync(config)).toStrictEqual(original);
            expect(statSync(config).mode).toBe(mode);
            expect(readFileSync(untracked)).toStrictEqual(Buffer.from([0, 255, 1, 2]));
            expect(readFileSync(join(directory.path, join(scope, 'next-env.d.ts')), 'utf8')).toBe(
                '// Authored type declaration\n',
            );
            expect(readFileSync(join(directory.path, join(scope, '.next/types/routes.d.ts')), 'utf8')).toBe(
                '// Retained route types\n',
            );
            expect(readFileSync(join(directory.path, 'unrelated/private.txt'), 'utf8')).toBe(
                'Preserve unrelated scope\n',
            );
        });

test('failed type generation cleans the isolated copy without restoring over source edits', async () => {
    const diagnostic = 'Generator failed';
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': policyOf(['nextjs']),
        'package.json': '{"private":true}\n',
        'tsconfig.json': '{}\n',
    });
    const session = await openSession(directory.path);
    const spec = session.manifests.get('nextjs')!.checks.find((entry) => entry.name === 'nextjs/tsc')!;
    const input: EngineInput = scopeInput(session, spec);
    let scratch = '';
    const locate = spyOn(executables, 'sync').mockReturnValue(process.execPath);
    const run = spyOn(processes, 'run').mockImplementation((_command, options) => {
        scratch = options.cwd;
        writeFileSync(join(scratch, 'tsconfig.json'), 'partial generator output\n');
        writeFileSync(join(directory.path, 'tsconfig.json'), 'Concurrent developer edit\n');
        return Promise.resolve({
            code: 1,
            missing: false,
            duration: 1,
            stdout: '',
            stderr: `Error: ${diagnostic}`,
        });
    });
    try {
        expect(await rejection(nextjsTypes(input))).toContain(diagnostic);
        expect(scratch).not.toBe('');
        expect(existsSync(scratch)).toBe(false);
        expect(readFileSync(join(directory.path, 'tsconfig.json'), 'utf8')).toBe('Concurrent developer edit\n');
        expect(existsSync(join(directory.path, 'next-env.d.ts'))).toBe(false);
    } finally {
        locate.mockRestore();
        run.mockRestore();
    }
});
