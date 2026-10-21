import { readFileSync } from 'node:fs';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { isOnDisk } from '#tests/setup/files.ts';
import { join, dirname, resolve } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { fakeNpmTool } from '#tests/setup/fakes.ts';
import * as processes from '#cli/system/processes.ts';
import { type Finding } from '#cli/types/runs/check.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildProcessResult } from '#tests/setup/builders.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { SVELTE_PROJECTS, SVELTE_CHECK_OUTPUT } from '#tests/data/checks/svelte.ts';
import { textSchema, pathsSchema, fieldsSchema } from '#tests/schemas/checks/typescript.ts';
import { checkFindings, findBuiltInCheck, planSandboxCheck } from '#tests/setup/check-input.ts';

/** Run svelte-check against one fake output in the selected scope. */
async function runSvelteCheck(stdout: string, options: { scope?: string } = {}): Promise<Finding[]> {
    const scope = options.scope ?? '';
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['svelte'], {
            tables: scope === '' ? '' : `[[scope]]\npath = "${scope}"\n`,
        }),
        [scope === '' ? 'src/Count.svelte' : `${scope}/src/Count.svelte`]: '<p>Count</p>',
    });
    await fakeNpmTool(sandbox.path, 'svelte-check');
    using _run = spyOn(processes, 'spawnProcess').mockResolvedValue(buildProcessResult({ code: 1, stdout }));
    const session = await openSession(sandbox.path);
    return await findBuiltInCheck('svelte/svelte-check')(
        session,
        planSandboxCheck(session, 'svelte/svelte-check', { scope }),
    );
}

test.each([...SVELTE_PROJECTS])(
    'svelte-check uses the runtime project for $name',
    async ({ scope, settings, authored }) => {
        await using sandbox = await testdir({
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
        await fakeNpmTool(sandbox.path, 'svelte-check');

        let runtimePath = '';
        using run = spyOn(processes, 'spawnProcess').mockImplementation((commandArguments, options) => {
            runtimePath = textSchema.parse(commandArguments[commandArguments.indexOf('--tsconfig') + 1]);
            const config = fieldsSchema.parse(JSON.parse(readFileSync(runtimePath, 'utf8')));
            expect(options.cwd).toBe(join(sandbox.path, scope));
            expect(runtimePath.startsWith(sandbox.path)).toBe(false);
            const compilerOptions = fieldsSchema.parse(config['compilerOptions']);
            expect(
                pathsSchema.parse(compilerOptions['typeRoots']).map((path) => resolve(dirname(runtimePath), path)),
            ).toContain(join(sandbox.path, 'node_modules/@types'));
            if (authored) {
                expect(resolve(dirname(runtimePath), textSchema.parse(config['extends']))).toBe(
                    join(sandbox.path, scope, 'tsconfig.json'),
                );
            } else {
                expect(
                    pathsSchema.parse(config['include']).map((path) => resolve(dirname(runtimePath), path)),
                ).toStrictEqual([join(sandbox.path, 'Component.svelte')]);
            }
            return Promise.resolve(buildProcessResult());
        });
        expect(await checkFindings(sandbox.path, 'svelte/svelte-check', { scope })).toStrictEqual([]);
        expect(run).toHaveBeenCalledTimes(1);
        expect(await isOnDisk(runtimePath)).toBe(false);
    },
);

test('svelte-check errors and warnings become findings at one-based positions with their code as the rule', async () => {
    expect(await runSvelteCheck(SVELTE_CHECK_OUTPUT)).toStrictEqual([
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
    const nested = await runSvelteCheck(SVELTE_CHECK_OUTPUT, { scope: 'apps/web' });
    expect(nested[0]?.file).toBe('apps/web/src/Count.svelte');
});

// POSIX treats a backslash as a file-name character; Windows treats it as a directory separator.
test('file-name separators follow the current platform', async () => {
    const findings = await runSvelteCheck(
        SVELTE_CHECK_OUTPUT.replace('src/Count.svelte', String.raw`src\\Count.svelte`),
    );
    expect(findings[0]?.file).toBe(process.platform === 'win32' ? 'src/Count.svelte' : String.raw`src\Count.svelte`);
});

test('a svelte-check failure line is an error, not a clean result', async () => {
    expect(
        await captureRejection(runSvelteCheck('1758823456790 FAILURE "Failed to locate tsconfig or jsconfig"')),
    ).toBe('The svelte-check run failed: Failed to locate tsconfig or jsconfig');
});
