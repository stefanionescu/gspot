import { join } from 'node:path';
import { toolPin } from '#cli/tools/pins.ts';
import * as tools from '#cli/tools/inspect.ts';
import { test, spyOn, expect } from 'bun:test';
import { toPosix } from '#cli/platform/paths.ts';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { mockPinnedExecutables } from '#tests/harness/pins.ts';
import { typesFresh } from '#cli/checks/platform/cloudflare.ts';
import { statSync, chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
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
                : buildPolicy([], { tables: `[[scope]]\npath = "${scope}"\nconfigurations = ["cloudflare"]\n` }),
        [join(scope, 'package.json')]: '{"private":true}\n',
        [join(scope, 'worker-configuration.d.ts')]: '// Committed types\n',
        [join(scope, 'bindings.txt')]: bindings,
        [join(scope, 'types')]: CLOUDFLARE_TYPES_GENERATOR,
    });
    commitAll(directory.path);
    const target = join(directory.path, join(scope, 'worker-configuration.d.ts'));
    const edited = '// Developer types\n';
    writeFileSync(target, edited);
    chmodSync(target, 0o640);
    const session = await openSession(directory.path);
    const spec = session.manifests.get('cloudflare')!.checks.find((entry) => entry.name === 'cloudflare/types-fresh')!;
    const input = buildEngineInput(session, spec.name, { scope: scope });
    const locate = spyOn(tools, 'inspectTool').mockReturnValue({
        name: 'wrangler',
        state: 'host',
        path: process.execPath,
    });
    return {
        directory,
        path: (name: string) => join(scope, name),
        target,
        edited,
        mode: statSync(target).mode,
        spec,
        input,
        locate,
    };
}

// The developer's edit, its mode, and the absence of generator side effects, whatever the generator did.
function expectPreserved({ directory, path, target, edited, mode }: WorkerTypesProject): void {
    expect(readFileSync(target, 'utf8')).toBe(edited);
    expect(statSync(target).mode).toBe(mode);
    expect(existsSync(join(directory.path, path('generated-note.txt')))).toBe(false);
}

test.each(CLOUDFLARE_TYPES_SCOPES)(
    'Cloudflare types in %s report a failed generation and preserve source',
    async (scope) => {
        const testRepository = await applyChanges(scope, 'failure');
        await using directory = testRepository.directory;
        try {
            expect(await rejection(typesFresh(testRepository.input))).toContain('Types generation failed');
            expectPreserved(testRepository);
            expect(readFileSync(join(directory.path, testRepository.path('bindings.txt')), 'utf8')).toBe('failure');
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
            expect(await typesFresh(testRepository.input)).toStrictEqual([
                {
                    check: testRepository.spec.name,
                    file: toPosix(testRepository.path('worker-configuration.d.ts')),
                    line: 1,
                    rule: 'stale',
                    message: 'wrangler types writes this file differently. Run it and commit the result.',
                    fixable: false,
                },
            ]);
            writeFileSync(join(directory.path, testRepository.path('bindings.txt')), testRepository.edited);
            expect(await typesFresh(testRepository.input)).toStrictEqual([]);
            expectPreserved(testRepository);
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
            tables: '[[scope]]\npath = "workers/api"\nconfigurations = ["cloudflare"]\n[scope.cloudflare]\ntypes_file = "cloudflare-env.d.ts"\ntypes_interface = "CloudflareEnv"\n',
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
        await typesFresh(buildEngineInput(session, 'cloudflare/types-fresh', { scope: 'workers/api' })),
    ).toStrictEqual([]);
    expect(directories).toHaveLength(1);
    expect(directories[0]).not.toBe(join(sandbox.path, 'workers/api'));
    expect(existsSync(directories[0]!)).toBe(false);
    expect(readFileSync(join(sandbox.path, 'workers/api/cloudflare-env.d.ts'), 'utf8')).toBe(source);
});
