import { join } from 'node:path';
import { chmodSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { toolPin } from '#cli/configurations/pins.ts';
import { openSession } from '#cli/execution/session.ts';
import { test, spyOn, expect, describe } from 'bun:test';
import { buildEngineInput } from '#tests/harness/input.ts';
import { svelteCheck, svelteFindings } from '#cli/checks/framework/svelte.ts';
import { LINES, PROJECTS, SCANNERS } from '#tests/config/cli/checks/framework/svelte.ts';

test.each(PROJECTS)('svelte-check selects the $name TypeScript target', async ({ scope, policy, target }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        'Component.svelte': '<p>Root</p>\n',
        'app/Component.svelte': '<p>Nested</p>\n',
    });
    const session = await openSession(sandbox.path);
    const pin = toolPin(session.manifests.values(), 'svelte-check');
    const scanner = process.platform === 'win32' ? SCANNERS.windows : SCANNERS.posix;
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/svelte-check/package.json': JSON.stringify({
            name: pin.installers['npm']!.name,
            version: pin.version,
        }),
        [scanner.path]: scanner.body.replace('VERSION', pin.version!),
    });
    chmodSync(join(sandbox.path, scanner.path), 0o755);
    const input = buildEngineInput(session, 'svelte/check', { scope });
    using resources = new DisposableStack();
    resources.use(
        spyOn(processes, 'run').mockImplementation((argv, options) => {
            const flag = argv.indexOf('--tsconfig');
            expect(flag === -1 ? undefined : argv[flag + 1]).toBe(
                target === undefined ? undefined : join(sandbox.path, target),
            );
            expect(options.cwd).toBe(join(sandbox.path, scope));
            return Promise.resolve({ code: 0, missing: false, stdout: '', stderr: '', duration: 1 });
        }),
    );
    expect(await svelteCheck(input)).toStrictEqual([]);
});

describe('svelteFindings', () => {
    test('errors and warnings become findings at one-based positions with their code as the rule', () => {
        expect(svelteFindings('svelte/check', '', LINES)).toStrictEqual([
            {
                check: 'svelte/check',
                file: 'src/Count.svelte',
                line: 2,
                column: 11,
                rule: 'TS2322',
                message: "Type 'string' is not assignable to type 'number'.",
                fixable: false,
            },
            {
                check: 'svelte/check',
                file: 'src/Product.svelte',
                line: 5,
                column: 1,
                rule: 'a11y_missing_attribute',
                message: '`<img>` element should have an alt attribute',
                fixable: false,
            },
        ]);
        expect(svelteFindings('svelte/check', 'apps/web', LINES)[0]?.file).toBe('apps/web/src/Count.svelte');
    });

    // svelte-check prints Windows paths with backslashes, which a finding never carries.
    test.skipIf(process.platform !== 'win32')('a Windows file name becomes a forward-slash path', () => {
        expect(
            svelteFindings('svelte/check', '', LINES.replace('src/Count.svelte', String.raw`src\\Count.svelte`))[0]
                ?.file,
        ).toBe('src/Count.svelte');
    });

    test('a failure line is an error, not a clean result', () => {
        expect(() =>
            svelteFindings('svelte/check', '', '1758823456790 FAILURE "Failed to locate tsconfig or jsconfig"'),
        ).toThrow('The svelte-check run failed: Failed to locate tsconfig or jsconfig');
    });
});
