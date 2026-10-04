import { join } from 'node:path';
import * as tools from '#cli/tools/inspect.ts';
import { test, spyOn, expect } from 'bun:test';
import { toPosix } from '#cli/platform/paths.ts';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { headers, typesFresh } from '#cli/checks/platform/cloudflare.ts';
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

test('Cloudflare header checks report only files in their owning scope', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['cloudflare'], {
            tables: '[[scope]]\npath = "workers/api"\nconfigurations = ["cloudflare"]\n',
        }),
        _headers: '  Invalid header\n',
        'workers/api/_headers': '/*\n  X-Frame-Options: DENY\n',
    });
    const session = await openSession(directory.path);
    const spec = session.manifests.get('cloudflare')!.checks.find((entry) => entry.name === 'cloudflare/headers')!;
    const input = buildEngineInput(session, spec.name);
    const found = headers(input);
    expect(found).toStrictEqual([
        {
            check: spec.name,
            file: '_headers',
            line: 1,
            rule: 'syntax',
            message: 'This header sits under no path.',
            fixable: false,
        },
    ]);
    expect(headers({ ...input, scope: 'workers/api' })).toStrictEqual([]);
    writeFileSync(join(directory.path, '_headers'), '/*\n  X-Frame-Options: DENY\n');
    const corrected = await openSession(directory.path);
    expect(headers(buildEngineInput(corrected, spec.name))).toStrictEqual([]);
});
