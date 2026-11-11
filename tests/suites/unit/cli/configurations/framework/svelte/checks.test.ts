import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

import { expect, test } from 'bun:test';

import { openSession } from '#cli/engine/session.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { Finding } from '#cli/types/engine/run.ts';
import { SVELTE_CHECK_FINDINGS, SVELTE_CHECK_OUTPUT, SVELTE_PROJECTS } from '#tests/config/configurations/framework.ts';
import { getBuiltInCheck, planSandboxCheck, runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { captureRejection, matchFields } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { tsconfigSchema } from '#tests/setup/schemas.ts';
import { fakeCommands, fakeNpmTool } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

async function runSvelteCheck(stdout: string, options: { scope?: string } = {}): Promise<Finding[]> {
    const scope = options.scope ?? '';
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['svelte'], { scopes: scope === '' ? [] : [{ path: scope }] }),
        [scope === '' ? 'src/Count.svelte' : `${scope}/src/Count.svelte`]: '<p>Count</p>',
    });
    await fakeNpmTool(sandbox.path, 'svelte-check');
    using _run = fakeCommands().mockResolvedValue(buildProcessResult({ code: 1, stdout }));
    const session = await openSession(sandbox.path);
    return await getBuiltInCheck('svelte/svelte-check')(
        session,
        planSandboxCheck(session, 'svelte/svelte-check', { scope }),
    );
}

test.each([...SVELTE_PROJECTS])(
    'svelte-check reads a temporary tsconfig that extends the scope tsconfig or lists the scope files: $name',
    async ({ scope, configurations, files, extends: extended, include }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(configurations, { scopes: [{ path: 'app' }] }),
            'Component.svelte': '<p>Root</p>\n',
            'app/Component.svelte': '<p>Nested</p>\n',
            ...files,
        });
        await fakeNpmTool(sandbox.path, 'svelte-check');
        let runtimePath = '';
        const seen: unknown[] = [];
        using _run = fakeCommands().mockImplementation((commandArguments, options) => {
            runtimePath = commandArguments[commandArguments.indexOf('--tsconfig') + 1] ?? '';
            const config = tsconfigSchema.parse(JSON.parse(readFileSync(runtimePath, 'utf8')));
            const runtimeFolder = dirname(runtimePath);
            const extendedPath =
                config.extends === undefined
                    ? null
                    : convertToPosixPath(relative(sandbox.path, resolve(runtimeFolder, config.extends)));

            seen.push({
                cwd: convertToPosixPath(relative(sandbox.path, options.cwd)),
                insideSandbox: runtimePath.startsWith(sandbox.path),
                extends: extendedPath,
                include:
                    config.include === undefined
                        ? null
                        : config.include.map((path) =>
                              convertToPosixPath(relative(sandbox.path, resolve(runtimeFolder, path))),
                          ),
            });
            return Promise.resolve(buildProcessResult());
        });
        expect(await runSandboxCheck(sandbox.path, 'svelte/svelte-check', { scope })).toStrictEqual([]);
        expect(seen).toStrictEqual([
            {
                cwd: scope,
                insideSandbox: false,
                extends: extended,
                include,
            },
        ]);
        expect(existsSync(runtimePath)).toBe(false);
    },
);

test('svelte-check errors and warnings become findings at one-based positions with their code as the rule', async () => {
    expect(await runSvelteCheck(SVELTE_CHECK_OUTPUT)).toStrictEqual(
        SVELTE_CHECK_FINDINGS.map((finding) => matchFields(finding)),
    );
    expect(await runSvelteCheck(SVELTE_CHECK_OUTPUT, { scope: 'apps/web' })).toStrictEqual(
        SVELTE_CHECK_FINDINGS.map((finding) => matchFields({ ...finding, file: `apps/web/${finding.file}` })),
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
    expect(error).toMatchObject({ name: 'CheckStop', status: 'error' });
    expect(error.message).toContain('Failed to locate tsconfig or jsconfig');
});
