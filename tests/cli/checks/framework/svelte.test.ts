import { join } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { fakeTool } from '#tests/harness/platforms.ts';
import { test, spyOn, expect, describe } from 'bun:test';
import { buildCheckInput } from '#tests/harness/input.ts';
import { toolPin } from '#cli/configurations/contracts.ts';
import { BUILT_IN_CALCULATIONS } from '#cli/checks/public.ts';
import { svelteFindings } from '#cli/checks/framework/contracts.ts';
import { LINES, PROJECTS } from '#tests/config/cli/checks/framework/svelte.ts';

test.each(PROJECTS)('svelte-check selects the $name TypeScript target', async ({ scope, policy, target }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        'Component.svelte': '<p>Root</p>\n',
        'app/Component.svelte': '<p>Nested</p>\n',
    });
    const session = await openSession(sandbox.path);
    const pin = toolPin(session.manifests.values(), 'svelte-check');
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/svelte-check/package.json': JSON.stringify({
            name: pin.installers['npm']!.name,
            version: pin.version,
        }),
    });
    await fakeTool(
        sandbox.path,
        '.gspot/node_modules/.bin/svelte-check',
        `console.log(${JSON.stringify(pin.version!)});`,
    );
    const input = buildCheckInput(session, 'svelte/svelte-check', { scope });
    using run = spyOn(processes, 'run').mockResolvedValue({
        code: 0,
        missing: false,
        stdout: '',
        stderr: '',
        duration: 1,
    });
    expect(await BUILT_IN_CALCULATIONS['svelte/svelte-check'](input)).toStrictEqual([]);
    expect(
        run.mock.calls.map(([argv, options]) => ({
            target: argv.includes('--tsconfig') ? argv[argv.indexOf('--tsconfig') + 1] : undefined,
            cwd: options.cwd,
        })),
    ).toStrictEqual([
        {
            target: target === undefined ? undefined : join(sandbox.path, target),
            cwd: join(sandbox.path, scope),
        },
    ]);
});

describe('svelteFindings', () => {
    test('errors and warnings become findings at one-based positions with their code as the rule', () => {
        expect(svelteFindings('svelte/svelte-check', '', LINES)).toStrictEqual([
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
        expect(svelteFindings('svelte/svelte-check', 'apps/web', LINES)[0]?.file).toBe('apps/web/src/Count.svelte');
    });

    // svelte-check prints Windows paths with backslashes, which a finding never carries.
    test.skipIf(process.platform !== 'win32')('a Windows file name becomes a forward-slash path', () => {
        expect(
            svelteFindings(
                'svelte/svelte-check',
                '',
                LINES.replace('src/Count.svelte', String.raw`src\\Count.svelte`),
            )[0]?.file,
        ).toBe('src/Count.svelte');
    });

    test('a failure line is an error, not a clean result', () => {
        expect(() =>
            svelteFindings('svelte/svelte-check', '', '1758823456790 FAILURE "Failed to locate tsconfig or jsconfig"'),
        ).toThrow('The svelte-check run failed: Failed to locate tsconfig or jsconfig');
    });
});
