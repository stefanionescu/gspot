import { z } from 'zod';
import { test, spyOn, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { rejection } from '#tests/setup/matchers.ts';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/commands/session.ts';
import { fakeNpmTool } from '#tests/setup/fake-tool.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { processResult } from '#tests/setup/processes.ts';
import { svelteCheck } from '#cli/checks/framework/svelte.ts';
import { checkFindings, buildCheckInput } from '#tests/setup/check-input.ts';
import { SVELTE_PROJECTS, SVELTE_CHECK_OUTPUT } from '#tests/config/svelte.ts';

test.each([...SVELTE_PROJECTS])(
    'svelte-check uses the runtime project for $name',
    async ({ scope, settings, authored }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settings,
            'Component.svelte': '<p>Root</p>\n',
            'app/Component.svelte': '<p>Nested</p>\n',
        });
        if (authored)
            await createFileTree(sandbox.path, {
                'app/tsconfig.json': JSON.stringify({
                    compilerOptions: { strict: true },
                    include: ['Component.svelte'],
                }),
            });
        const session = await openSession(sandbox.path);
        await fakeNpmTool(sandbox.path, 'svelte-check');
        await createFileTree(sandbox.path, {});

        let runtimePath = '';
        using run = spyOn(processes, 'run').mockImplementation((argv, options) => {
            runtimePath = z.string().parse(argv[argv.indexOf('--tsconfig') + 1]);
            const config = z.record(z.string(), z.unknown()).parse(JSON.parse(readFileSync(runtimePath, 'utf8')));
            expect(options.cwd).toBe(join(sandbox.path, scope));
            expect(runtimePath.startsWith(sandbox.path)).toBe(false);
            const compilerOptions = z.record(z.string(), z.unknown()).parse(config['compilerOptions']);
            expect(
                z
                    .array(z.string())
                    .parse(compilerOptions['typeRoots'])
                    .map((path) => resolve(dirname(runtimePath), path)),
            ).toContain(join(sandbox.path, 'node_modules/@types'));
            if (authored) {
                expect(resolve(dirname(runtimePath), z.string().parse(config['extends']))).toBe(
                    join(sandbox.path, scope, 'tsconfig.json'),
                );
            } else {
                expect(
                    z
                        .array(z.string())
                        .parse(config['include'])
                        .map((path) => resolve(dirname(runtimePath), path)),
                ).toStrictEqual([join(sandbox.path, 'Component.svelte')]);
            }
            return Promise.resolve(processResult());
        });
        expect(await checkFindings(session.root, 'svelte/svelte-check', { scope })).toStrictEqual([]);
        expect(run).toHaveBeenCalledTimes(1);
        expect(existsSync(runtimePath)).toBe(false);
    },
);

test('svelte-check errors and warnings become findings at one-based positions with their code as the rule', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['svelte'], { tables: '[[scope]]\npath = "apps/web"\n' }),
        'apps/web/src/Count.svelte': '<p>Count</p>',
    });
    const session = await openSession(sandbox.path);
    await fakeNpmTool(sandbox.path, 'svelte-check');
    using _run = spyOn(processes, 'run').mockResolvedValue(processResult({ code: 1, stdout: SVELTE_CHECK_OUTPUT }));
    const input = buildCheckInput(session, 'svelte/svelte-check');
    expect(await svelteCheck(input)).toStrictEqual([
        {
            check: 'svelte/svelte-check',
            file: 'src/Count.svelte',
            line: 2,
            column: 11,
            rule: 'TS2322',
            message: "Type 'string' is not assignable to type 'number'.",
            fixable: false,
        },
        {
            check: 'svelte/svelte-check',
            file: 'src/Product.svelte',
            line: 5,
            column: 1,
            rule: 'a11y_missing_attribute',
            message: '`<img>` element should have an alt attribute',
            fixable: false,
        },
    ]);
    const nested = await svelteCheck(buildCheckInput(session, 'svelte/svelte-check', { scope: 'apps/web' }));
    expect(nested[0]?.file).toBe('apps/web/src/Count.svelte');
});

// svelte-check prints Windows paths with backslashes, which a finding never carries.
test('a Windows file name becomes a forward-slash path', async () => {
    await using sandbox = await testdir({ 'gspot.toml': settingsText(['svelte']) });
    const input = buildCheckInput(await openSession(sandbox.path), 'svelte/svelte-check');
    await fakeNpmTool(sandbox.path, 'svelte-check');
    using _run = spyOn(processes, 'run').mockResolvedValue(
        processResult({
            code: 1,
            stdout: SVELTE_CHECK_OUTPUT.replace('src/Count.svelte', String.raw`src\\Count.svelte`),
        }),
    );
    const findings = await svelteCheck(input);
    expect(findings[0]?.file).toBe('src/Count.svelte');
});

test('a svelte-check failure line is an error, not a clean result', async () => {
    await using sandbox = await testdir({ 'gspot.toml': settingsText(['svelte']) });
    const input = buildCheckInput(await openSession(sandbox.path), 'svelte/svelte-check');
    await fakeNpmTool(sandbox.path, 'svelte-check');
    using _run = spyOn(processes, 'run').mockResolvedValue(
        processResult({ code: 1, stdout: '1758823456790 FAILURE "Failed to locate tsconfig or jsconfig"' }),
    );
    expect(await rejection(svelteCheck(input))).toBe(
        'The svelte-check run failed: Failed to locate tsconfig or jsconfig',
    );
});
