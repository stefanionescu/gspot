import { testdir } from 'testdirs';
import { readFileSync } from 'node:fs';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import * as processes from '#cli/system/processes.ts';
import { dirname, resolve, relative } from 'node:path';
import { type Finding } from '#cli/types/runs/check.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { fakeNpmTool } from '#tests/setup/system/fakes.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { textSchema, pathsSchema, fieldsSchema } from '#tests/schemas/checks/typescript.ts';
import { runSandboxCheck, findBuiltInCheck, planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { SVELTE_PROJECTS, SVELTE_CHECK_OUTPUT, SVELTE_CHECK_FINDINGS } from '#tests/config/checks/framework/svelte.ts';

async function runSvelteCheck(stdout: string, options: { scope?: string } = {}): Promise<Finding[]> {
    const scope = options.scope ?? '';
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['svelte'], { scopes: scope === '' ? [] : [{ path: scope }] }),
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
    'svelte-check reads a temporary tsconfig that extends the scope tsconfig or lists the scope files: $name',
    async ({ scope, settings, files, extends: extended, include }) => {
        await using sandbox = await testdir({
            'gspot.toml': settings,
            'Component.svelte': '<p>Root</p>\n',
            'app/Component.svelte': '<p>Nested</p>\n',
            ...files,
        });
        await fakeNpmTool(sandbox.path, 'svelte-check');

        let runtimePath = '';
        const seen: unknown[] = [];
        using run = spyOn(processes, 'spawnProcess').mockImplementation((commandArguments, options) => {
            runtimePath = textSchema.parse(commandArguments[commandArguments.indexOf('--tsconfig') + 1]);
            const config = fieldsSchema.parse(JSON.parse(readFileSync(runtimePath, 'utf8')));
            const fromSandbox = (path: string): string =>
                convertToPosixPath(relative(sandbox.path, resolve(dirname(runtimePath), path)));
            const compilerOptions = fieldsSchema.parse(config['compilerOptions']);
            seen.push({
                cwd: convertToPosixPath(relative(sandbox.path, options.cwd)),
                insideSandbox: runtimePath.startsWith(sandbox.path),
                typeRoots: pathsSchema.parse(compilerOptions['typeRoots']).map((path) => fromSandbox(path)),
                extends: 'extends' in config ? fromSandbox(textSchema.parse(config['extends'])) : null,
                include:
                    'include' in config ? pathsSchema.parse(config['include']).map((path) => fromSandbox(path)) : null,
            });
            return Promise.resolve(buildProcessResult());
        });
        expect(await runSandboxCheck(sandbox.path, 'svelte/svelte-check', { scope })).toStrictEqual([]);
        expect(run).toHaveBeenCalledTimes(1);
        expect(seen).toMatchObject([
            {
                cwd: scope,
                insideSandbox: false,
                typeRoots: expect.arrayContaining(['node_modules/@types']) as string[],
                extends: extended,
                include,
            },
        ]);
        expect(await isOnDisk(runtimePath)).toBe(false);
    },
);

test('svelte-check errors and warnings become findings at one-based positions with their code as the rule', async () => {
    expect(await runSvelteCheck(SVELTE_CHECK_OUTPUT)).toStrictEqual([...SVELTE_CHECK_FINDINGS]);
    expect(await runSvelteCheck(SVELTE_CHECK_OUTPUT, { scope: 'apps/web' })).toStrictEqual(
        SVELTE_CHECK_FINDINGS.map((finding) => ({ ...finding, file: `apps/web/${finding.file}` })),
    );
});

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
