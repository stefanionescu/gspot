import { testdir } from 'testdirs';
import { readFileSync } from 'node:fs';
import { test, spyOn, expect } from 'bun:test';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/planning/session.ts';
import { type Finding } from '#cli/types/runs/check.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { fakeNpmTool } from '#tests/setup/system/fakes.ts';
import { tsconfigSchema } from '#tests/schemas/tsconfig.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { sep, parse, dirname, resolve, relative } from 'node:path';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { runSandboxCheck, getBuiltInCheck, planSandboxCheck } from '#tests/setup/cli/checks.ts';
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
    return await getBuiltInCheck('svelte/svelte-check')(
        session,
        planSandboxCheck(session, 'svelte/svelte-check', { scope }),
    );
}

test.each([...SVELTE_PROJECTS])(
    'svelte-check reads a temporary tsconfig that extends the scope tsconfig or lists the scope files: $name',
    async ({ scope, configurations, files, extends: extended, include, typeRoots }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(configurations, { scopes: [{ path: 'app' }] }),
            'Component.svelte': '<p>Root</p>\n',
            'app/Component.svelte': '<p>Nested</p>\n',
            ...files,
        });
        await fakeNpmTool(sandbox.path, 'svelte-check');
        const parentRoots = Array.from(
            { length: relative(parse(sandbox.path).root, sandbox.path).split(sep).length },
            (_, index) => `${'../'.repeat(index + 1)}node_modules/@types`,
        );

        let runtimePath = '';
        const seen: unknown[] = [];
        using run = spyOn(processes, 'spawnProcess').mockImplementation((commandArguments, options) => {
            runtimePath = commandArguments[commandArguments.indexOf('--tsconfig') + 1] ?? '';
            const config = tsconfigSchema.parse(JSON.parse(readFileSync(runtimePath, 'utf8')));

            seen.push({
                cwd: convertToPosixPath(relative(sandbox.path, options.cwd)),
                insideSandbox: runtimePath.startsWith(sandbox.path),
                typeRoots: config.compilerOptions!.typeRoots!.map((path) =>
                    convertToPosixPath(relative(sandbox.path, resolve(dirname(runtimePath), path))),
                ),
                extends:
                    config.extends === undefined
                        ? null
                        : convertToPosixPath(relative(sandbox.path, resolve(dirname(runtimePath), config.extends))),
                include:
                    config.include === undefined
                        ? null
                        : config.include.map((path) =>
                              convertToPosixPath(relative(sandbox.path, resolve(dirname(runtimePath), path))),
                          ),
            });
            return Promise.resolve(buildProcessResult());
        });
        expect(await runSandboxCheck(sandbox.path, 'svelte/svelte-check', { scope })).toStrictEqual([]);
        expect(run).toHaveBeenCalledTimes(1);
        expect(seen).toStrictEqual([
            {
                cwd: scope,
                insideSandbox: false,
                typeRoots: [...typeRoots, ...parentRoots],
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

test('file-name separators follow the platform', async () => {
    const findings = await runSvelteCheck(
        SVELTE_CHECK_OUTPUT.replace('src/Count.svelte', String.raw`src\\Count.svelte`),
    );
    expect(findings[0]?.file).toBe(process.platform === 'win32' ? 'src/Count.svelte' : String.raw`src\Count.svelte`);
});

test('a svelte-check failure line is an error, not a clean result', async () => {
    const error = await captureRejection(
        runSvelteCheck('1758823456790 FAILURE "Failed to locate tsconfig or jsconfig"'),
    );
    expect(error.message).toBe('The svelte-check run failed: Failed to locate tsconfig or jsconfig');
});
