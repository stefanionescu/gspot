import { join, posix } from 'node:path';
import { toolPin } from '#cli/tools/pins.ts';
import { test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { mockPinnedExecutables } from '#tests/harness/pins.ts';
import { spectral, openapiFresh } from '#cli/checks/tool/openapi.ts';
import type { OpenapiProject } from '#tests/types/cli/checks/tool/openapi.ts';
import { statSync, chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { OPENAPI_FRESH_GENERATOR } from '#tests/config/cli/checks/tool/openapi-fresh.ts';

const OPENAPI_FRESH_POLICY = buildPolicy(['express'], {
    tables: '[tools.openapi]\ndocument = "openapi.json"\ngenerate = "bun generate.ts \\"\\" \\"two words\\""\n',
});

// A test Express project whose generator writes the document from schema.json and fails when the schema says so.
async function applyChanges(schema: string, scope: string): Promise<OpenapiProject> {
    const directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml':
            scope === ''
                ? OPENAPI_FRESH_POLICY
                : buildPolicy(['express'], {
                      tables: `[[scope]]\npath = "${scope}"\nconfigurations = ["express"]\n[scope.tools.openapi]\ndocument = "openapi.json"\ngenerate = "bun generate.ts \\"\\" \\"two words\\""\n`,
                  }),
        [posix.join(scope, 'package.json')]: '{"private":true}\n',
        [posix.join(scope, 'openapi.json')]: '{"version":1}\n',
        [posix.join(scope, 'schema.json')]: schema,
        [posix.join(scope, 'generate.ts')]: OPENAPI_FRESH_GENERATOR,
    });
    commitAll(directory.path);
    const document = join(directory.path, scope, 'openapi.json');
    const edited = '{"version":2}\n';
    writeFileSync(document, edited);
    chmodSync(document, 0o640);
    writeFileSync(join(directory.path, scope, '0009_manual.sql'), '-- Untracked manual migration\n');
    const session = await openSession(directory.path);
    const spec = session.manifests.get('openapi')!.checks.find((entry) => entry.name === 'openapi/fresh')!;
    const input = buildEngineInput(session, spec.name, { scope });
    return { directory, document, edited, mode: statSync(document).mode, spec, input };
}

// The dirty document, the untracked file, and the absence of generator side effects, whatever the generator did.
function expectPreserved({ directory, document, edited, mode, input }: OpenapiProject): void {
    expect(readFileSync(document, 'utf8')).toBe(edited);
    expect(statSync(document).mode).toBe(mode);
    expect(readFileSync(join(directory.path, input.scope, '0009_manual.sql'), 'utf8')).toBe(
        '-- Untracked manual migration\n',
    );
    expect(existsSync(join(directory.path, input.scope, 'side-effect.txt'))).toBe(false);
}

test.each(['', 'apps/api'])(
    'OpenAPI freshness in %s reports failed generation and preserves dirty and untracked input',
    async (scope) => {
        const testRepository = await applyChanges('{"fail":true}\n', scope);
        await using _directory = testRepository.directory;
        expect(await rejection(openapiFresh(testRepository.input))).toContain('Generation failed');
        expectPreserved(testRepository);
    },
);

test.each(['', 'apps/api'])(
    'OpenAPI freshness in %s reports stale output, accepts regeneration, and preserves input',
    async (scope) => {
        const testRepository = await applyChanges('{"version":3}\n', scope);
        await using directory = testRepository.directory;
        expect(await openapiFresh(testRepository.input)).toStrictEqual([
            {
                check: testRepository.spec.name,
                file: posix.join(scope, 'openapi.json'),
                line: 1,
                rule: 'stale',
                message: 'Running bun generate.ts "" "two words" changes this document; commit what it writes.',
                fixable: false,
            },
        ]);
        writeFileSync(join(directory.path, scope, 'schema.json'), testRepository.edited);
        expect(await openapiFresh(testRepository.input)).toStrictEqual([]);
        expectPreserved(testRepository);
    },
);

for (const check of [spectral, openapiFresh]) {
    test.each(['', 'apps/api'])(
        `${check.name} in %s identifies a missing configured document before starting a tool`,
        async (scope) => {
            await using sandbox = await testdir();
            const table =
                scope === ''
                    ? '[tools.openapi]'
                    : `[[scope]]\npath = "${scope}"\nconfigurations = ["openapi"]\n[scope.tools.openapi]`;
            await createFileTree(sandbox.path, {
                'gspot.toml': buildPolicy(['openapi'], {
                    tables: `${table}\ndocument = "openapi.json"\ngenerate = "bun generate.ts"\n`,
                }),
                [posix.join(scope, 'generate.ts')]: 'export {};',
            });
            const input = buildEngineInput(
                await openSession(sandbox.path),
                check === spectral ? 'openapi/spectral' : 'openapi/fresh',
                { scope },
            );
            using spawn = spyOn(processes, 'run');
            expect(await rejection(check(input))).toBe(
                `The tools.openapi.document setting names ${posix.join(scope, 'openapi.json')}, which does not exist.`,
            );
            expect(spawn).not.toHaveBeenCalled();
            expect(existsSync(join(sandbox.path, scope, 'openapi.json'))).toBe(false);
        },
    );
}

test.each(['', 'apps/api'])('Spectral in %s uses the project document and its generated ruleset', async (scope) => {
    await using sandbox = await testdir();
    const table =
        scope === ''
            ? '[tools.openapi]'
            : `[[scope]]\npath = "${scope}"\nconfigurations = ["openapi"]\n[scope.tools.openapi]`;
    const document = '{"openapi":"3.1.0"}';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['openapi'], { tables: `${table}\ndocument = "openapi.json"\n` }),
        [posix.join(scope, 'openapi.json')]: document,
    });
    const applied = await runGspot(sandbox.path, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const session = await openSession(sandbox.path);
    const planned = planRun(session, { stage: 'all', only: ['openapi/spectral'], skips: [] });
    expect(planned.map((entry) => entry.scope.scope.path)).toContain(scope);
    using resources = new DisposableStack();
    const pin = toolPin(session.manifests.values(), 'spectral');
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/.bin/spectral': 'fixture',
        '.gspot/node_modules/@stoplight/spectral-cli/package.json': JSON.stringify({
            name: pin.installers['npm']!.name,
            version: pin.version,
        }),
    });
    resources.use(mockPinnedExecutables([pin]));
    const commands: string[][] = [];
    const directories: string[] = [];
    resources.use(
        spyOn(processes, 'run').mockImplementation((argv, options) => {
            commands.push(argv.slice(1));
            directories.push(options.cwd);
            return Promise.resolve({
                code: 1,
                stdout: 'openapi.json:1:1 error missing-schema "Missing schema"',
                stderr: '',
                missing: false,
                duration: 1,
            });
        }),
    );
    expect(await spectral(buildEngineInput(session, 'openapi/spectral', { scope }))).toMatchObject([
        { file: posix.join(scope, 'openapi.json'), line: 1, rule: 'missing-schema' },
    ]);
    expect(directories).toStrictEqual([join(sandbox.path, scope)]);
    expect(commands).toStrictEqual([
        ['lint', '--ruleset', join(sandbox.path, '.gspot/config/spectral.yaml'), '--format', 'text', 'openapi.json'],
    ]);
    expect(readFileSync(join(sandbox.path, scope, 'openapi.json'), 'utf8')).toBe(document);
});
