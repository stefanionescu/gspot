import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { toPosix } from '#cli/platform/contracts.ts';
import * as processes from '#cli/platform/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { toolPin } from '#cli/configurations/contracts.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { BUILT_IN_CALCULATIONS } from '#cli/checks/public.ts';
import { mockPinnedExecutables } from '#tests/harness/pins.ts';
import { EXECUTABLE_FILE } from '#cli/config/platform/modes.ts';
import { stat, chmod, readFile, writeFile } from 'node:fs/promises';
import { configurationManifests } from '#cli/configurations/public.ts';
import type { WorkerTypesProject } from '#tests/types/cli/checks/platform/cloudflare.ts';

import {
    CLOUDFLARE_TYPES_SCOPES,
    CLOUDFLARE_TYPES_GENERATOR,
} from '#tests/config/cli/checks/platform/cloudflare/types.ts';

// The mocked version process uses an owned host shim, so native path inspection can read it.
async function mockWrangler(root: string): Promise<DisposableStack> {
    const pin = toolPin(configurationManifests().values(), 'wrangler');
    const path = join(root, 'node_modules', '.bin', pin.name);
    await Bun.write(path, '');
    await chmod(path, EXECUTABLE_FILE);
    return mockPinnedExecutables([pin]);
}

// A test Worker whose generator stands in for wrangler types: `bindings.txt` is what it writes, or the failure.
async function applyChanges(root: string, scope: string, content: string): Promise<WorkerTypesProject> {
    await createFileTree(root, {
        'gspot.toml':
            scope === ''
                ? buildPolicy(['cloudflare'])
                : buildPolicy([], { tables: `[scope."${scope}"]\nconfigurations = ["cloudflare"]\n` }),
        [join(scope, 'package.json')]: '{"private":true}\n',
        [join(scope, 'worker-configuration.d.ts')]: '// Committed types\n',
        [join(scope, 'bindings.txt')]: content,
        [join(scope, 'types')]: CLOUDFLARE_TYPES_GENERATOR,
    });
    commitAll(root);
    const target = join(root, join(scope, 'worker-configuration.d.ts'));
    const edited = '// Developer types\n';
    await writeFile(target, edited);
    await chmod(target, 0o640);
    const session = await openSession(root);
    const input = buildCheckInput(session, 'cloudflare/stale-types', { scope });
    const { mode } = await stat(target);
    return {
        path: (name: string) => join(scope, name),
        target,
        edited,
        mode,
        input,
    };
}

// The developer's edit, its mode, and the absence of generator side effects, whatever the generator did.
async function expectPreserved(root: string, { path, target, edited, mode }: WorkerTypesProject): Promise<void> {
    expect(await readFile(target, 'utf8')).toBe(edited);
    const current = await stat(target);
    expect(current.mode).toBe(mode);
    expect(await pathExists(join(root, path('generated-note.txt')))).toBe(false);
}

test.each(CLOUDFLARE_TYPES_SCOPES)(
    'Cloudflare types in %s report a failed generation and preserve source',
    async (scope) => {
        await using directory = await testdir();
        const testRepository = await applyChanges(directory.path, scope, 'failure');
        using _executables = await mockWrangler(directory.path);
        const run = processes.run;
        using _generator = spyOn(processes, 'run').mockImplementation((argv, options) =>
            run([process.execPath, ...argv.slice(1)], options),
        );
        expect(await rejection(BUILT_IN_CALCULATIONS['supabase/stale-types'](testRepository.input))).toContain(
            'Types generation failed',
        );
        await expectPreserved(directory.path, testRepository);
    },
);

test.each(CLOUDFLARE_TYPES_SCOPES)(
    'Cloudflare types in %s report stale types, accept regenerated ones, and preserve source',
    async (scope) => {
        await using directory = await testdir();
        const testRepository = await applyChanges(directory.path, scope, '// Generated types\n');
        using _executables = await mockWrangler(directory.path);
        const run = processes.run;
        using _generator = spyOn(processes, 'run').mockImplementation((argv, options) =>
            run([process.execPath, ...argv.slice(1)], options),
        );
        const findings = await BUILT_IN_CALCULATIONS['supabase/stale-types'](testRepository.input);
        expect(findings).toMatchObject([
            {
                check: testRepository.input.check.name,
                file: toPosix(testRepository.path('worker-configuration.d.ts')),
                line: 1,
                rule: 'stale',
                fixable: false,
            },
        ]);
        expect(findings[0]!.message).toContain('"wrangler","types"');
        await writeFile(join(directory.path, testRepository.path('bindings.txt')), testRepository.edited);
        expect(await BUILT_IN_CALCULATIONS['supabase/stale-types'](testRepository.input)).toStrictEqual([]);
        await expectPreserved(directory.path, testRepository);
    },
);

test('custom Worker type files retain the configured interface and child scope', async () => {
    await using sandbox = await testdir();
    const source = 'interface CloudflareEnv {}\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], {
            tables: '[scope."workers/api"]\nconfigurations = ["cloudflare"]\n[scope."workers/api".cloudflare]\ntypes_file = "cloudflare-env.d.ts"\ntypes_interface = "CloudflareEnv"\n',
        }),
        'workers/api/cloudflare-env.d.ts': source,
    });
    const session = await openSession(sandbox.path);
    using resources = new DisposableStack();
    resources.use(await mockWrangler(sandbox.path));
    const directories: string[] = [];
    resources.use(
        spyOn(processes, 'run').mockImplementation(async (argv, options) => {
            expect(argv.slice(1)).toStrictEqual(['types', 'cloudflare-env.d.ts', '--env-interface', 'CloudflareEnv']);
            directories.push(options.cwd);
            await Bun.write(join(options.cwd, 'cloudflare-env.d.ts'), source);
            return { code: 0, stdout: '', stderr: '', missing: false, duration: 1 };
        }),
    );
    expect(
        await BUILT_IN_CALCULATIONS['supabase/stale-types'](
            buildCheckInput(session, 'cloudflare/stale-types', { scope: 'workers/api' }),
        ),
    ).toStrictEqual([]);
    expect(directories).toHaveLength(1);
    expect(directories[0]).not.toBe(join(sandbox.path, 'workers/api'));
    expect(await pathExists(directories[0]!)).toBe(false);
    expect(await readFile(join(sandbox.path, 'workers/api/cloudflare-env.d.ts'), 'utf8')).toBe(source);
});
