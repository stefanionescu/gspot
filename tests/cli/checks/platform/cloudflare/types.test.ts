import { join } from 'node:path';
import * as tools from '#cli/tools/public.ts';
import { test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/public.ts';
import { toPosix } from '#cli/platform/contracts.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { toolPin } from '#cli/configurations/contracts.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { mockPinnedExecutables } from '#tests/harness/pins.ts';
import { stat, chmod, readFile, writeFile } from 'node:fs/promises';
import { rejection, textContaining } from '#tests/harness/expectations.ts';
import type { WorkerTypesProject } from '#tests/types/cli/checks/platform/cloudflare.ts';

import {
    CLOUDFLARE_TYPES_SCOPES,
    CLOUDFLARE_TYPES_GENERATOR,
} from '#tests/config/cli/checks/platform/cloudflare/types.ts';

// A test Worker whose generator stands in for wrangler types: `bindings.txt` is what it writes, or the failure.
async function applyChanges(scope: string, bindings: string): Promise<WorkerTypesProject> {
    const directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml':
            scope === ''
                ? buildPolicy(['cloudflare'])
                : buildPolicy([], { tables: `[scope."${scope}"]\nconfigurations = ["cloudflare"]\n` }),
        [join(scope, 'package.json')]: '{"private":true}\n',
        [join(scope, 'worker-configuration.d.ts')]: '// Committed types\n',
        [join(scope, 'bindings.txt')]: bindings,
        [join(scope, 'types')]: CLOUDFLARE_TYPES_GENERATOR,
    });
    commitAll(directory.path);
    const target = join(directory.path, join(scope, 'worker-configuration.d.ts'));
    const edited = '// Developer types\n';
    await writeFile(target, edited);
    await chmod(target, 0o640);
    const session = await openSession(directory.path);
    const input = buildCheckInput(session, 'cloudflare/stale-types', { scope });
    const locate = spyOn(tools, 'inspectTool').mockReturnValue({
        name: 'wrangler',
        state: 'host',
        path: process.execPath,
    });
    const { mode } = await stat(target);
    return {
        directory,
        path: (name: string) => join(scope, name),
        target,
        edited,
        mode,
        input,
        locate,
    };
}

// The developer's edit, its mode, and the absence of generator side effects, whatever the generator did.
async function expectPreserved({ directory, path, target, edited, mode }: WorkerTypesProject): Promise<void> {
    expect(await readFile(target, 'utf8')).toBe(edited);
    const current = await stat(target);
    expect(current.mode).toBe(mode);
    expect(await pathExists(join(directory.path, path('generated-note.txt')))).toBe(false);
}

test.each(CLOUDFLARE_TYPES_SCOPES)(
    'Cloudflare types in %s report a failed generation and preserve source',
    async (scope) => {
        const testRepository = await applyChanges(scope, 'failure');
        await using directory = testRepository.directory;
        try {
            expect(await rejection(BUILT_IN_CHECKS['supabase/stale-types'].input(testRepository.input))).toContain(
                'Types generation failed',
            );
            await expectPreserved(testRepository);
            expect(await readFile(join(directory.path, testRepository.path('bindings.txt')), 'utf8')).toBe('failure');
        } finally {
            testRepository.locate.mockRestore();
        }
    },
);

test.each(CLOUDFLARE_TYPES_SCOPES)(
    'Cloudflare types in %s report stale types, accept regenerated ones, and preserve source',
    async (scope) => {
        const testRepository = await applyChanges(scope, '// Generated types\n');
        await using directory = testRepository.directory;
        try {
            expect(await BUILT_IN_CHECKS['supabase/stale-types'].input(testRepository.input)).toStrictEqual([
                {
                    check: testRepository.input.check.name,
                    file: toPosix(testRepository.path('worker-configuration.d.ts')),
                    line: 1,
                    rule: 'stale',
                    message: textContaining('changes this generated file; commit what it writes.'),
                    fixable: false,
                },
            ]);
            await writeFile(join(directory.path, testRepository.path('bindings.txt')), testRepository.edited);
            expect(await BUILT_IN_CHECKS['supabase/stale-types'].input(testRepository.input)).toStrictEqual([]);
            await expectPreserved(testRepository);
        } finally {
            testRepository.locate.mockRestore();
        }
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
    resources.use(mockPinnedExecutables([toolPin(session.manifests.values(), 'wrangler')]));
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
        await BUILT_IN_CHECKS['supabase/stale-types'].input(
            buildCheckInput(session, 'cloudflare/stale-types', { scope: 'workers/api' }),
        ),
    ).toStrictEqual([]);
    expect(directories).toHaveLength(1);
    expect(directories[0]).not.toBe(join(sandbox.path, 'workers/api'));
    expect(await pathExists(directories[0]!)).toBe(false);
    expect(await readFile(join(sandbox.path, 'workers/api/cloudflare-env.d.ts'), 'utf8')).toBe(source);
});
