import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { rejection } from '#tests/support/expectations.ts';
import type { EngineInput } from '#cli/types/checks/checks.ts';
import { nextjsBuild, nextjsTypes } from '#cli/checks/nextjs/build.ts';
import { statSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { prepareNextjsBuild, observeNextjsCommands } from '#tests/support/cli/nextjs.ts';

for (const scope of ['', 'apps/web'])
    for (const check of ['nextjs/typecheck', 'nextjs/build'])
        test(`Next.js output preservation in ${scope || 'root'}: ${check} reports a defect, accepts its correction, and preserves source output`, async () => {
            await using directory = await testdir();
            const input = await prepareNextjsBuild(directory.path, scope, check);
            const untracked = join(directory.path, join(scope, '.next/local-cache.bin'));
            const config = join(directory.path, join(scope, 'tsconfig.json'));
            const original = readFileSync(config);
            const mode = statSync(config).mode;
            using observed = observeNextjsCommands(check);
            const { directories, inspections, routesSeen } = observed;
            const execute = check === 'nextjs/typecheck' ? nextjsTypes : nextjsBuild;
            const found = await execute(input);
            expect(found).toHaveLength(1);
            expect(found[0]).toMatchObject({
                check,
                file: join(scope, check === 'nextjs/typecheck' ? 'src/page.ts' : 'package.json').replaceAll('\\', '/'),
                line: 1,
            });
            expect(found[0]!.message).toBe(
                check === 'nextjs/typecheck' ? 'Type mismatch' : 'next build failed: Error: Page is invalid',
            );
            writeFileSync(join(directory.path, join(scope, 'src/page.ts')), 'corrected input\n');
            expect(await execute(input)).toStrictEqual([]);
            expect(directories).toHaveLength(check === 'nextjs/typecheck' ? 4 : 2);
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

test.each(['Generator failed', 'unknown command', 'Invalid project directory'])(
    'failed type generation %s cleans the isolated copy without restoring over source edits',
    async (diagnostic) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'gspot.toml': 'version = 1\nconfigurations = ["nextjs"]\n',
            'package.json': '{"private":true}\n',
            'tsconfig.json': '{}\n',
        });
        const session = await openSession(directory.path);
        const spec = session.manifests.get('nextjs')!.checks.find((entry) => entry.name === 'nextjs/typecheck')!;
        const input: EngineInput = engineInput(session, {
            scope: session.scopes.find((entry) => entry.scope.path === '')!,
            spec: spec,
            files: session.repository.files,
        });
        let scratch = '';
        const locate = spyOn(Bun, 'which').mockReturnValue(process.execPath);
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
    },
);
