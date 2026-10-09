import { join, posix } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { planRun } from '#cli/planning/public.ts';
import { commitAll } from '#tests/harness/git.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { toolPin } from '#cli/configurations/contracts.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { mockPinnedExecutables } from '#tests/harness/pins.ts';
import { runCheckCommand } from '#cli/execution/command/public.ts';
import type { OpenapiProject } from '#tests/types/cli/checks/openapi.ts';
import { rejection, textContaining } from '#tests/harness/expectations.ts';
import { stat, chmod, unlink, readFile, writeFile } from 'node:fs/promises';

import {
    SPECTRAL_RESULT,
    SPECTRAL_SCOPES,
    SPECTRAL_FINDING,
    OPENAPI_FRESH_GENERATOR,
    SPECTRAL_MISSING_DOCUMENT,
} from '#tests/config/cli/checks/tool/openapi-fresh.ts';

const OPENAPI_FRESH_POLICY = buildPolicy(['express', 'openapi'], {
    tables: '[openapi]\ndocument = "openapi.json"\ngenerate_command = ["bun", "generate.ts", "", "two words"]\n',
});

// A test Express project whose generator writes the document from schema.json and fails when the schema says so.
async function applyChanges(root: string, schema: string, scope: string): Promise<OpenapiProject> {
    await createFileTree(root, {
        'gspot.toml':
            scope === ''
                ? OPENAPI_FRESH_POLICY
                : buildPolicy(['express'], {
                      tables: `[scope."${scope}"]\nconfigurations = ["express", "openapi"]\n[scope."${scope}".openapi]\ndocument = "openapi.json"\ngenerate_command = ["bun", "generate.ts", "", "two words"]\n`,
                  }),
        [posix.join(scope, 'package.json')]: '{"private":true}\n',
        [posix.join(scope, 'openapi.json')]: '{"version":1}\n',
        [posix.join(scope, 'schema.json')]: schema,
        [posix.join(scope, 'generate.ts')]: OPENAPI_FRESH_GENERATOR,
    });
    commitAll(root);
    const document = join(root, scope, 'openapi.json');
    const edited = '{"version":2}\n';
    await writeFile(document, edited);
    await chmod(document, 0o640);
    await writeFile(join(root, scope, 'notes.txt'), 'Untracked project notes\n');
    const session = await openSession(root);
    const check = session.manifests.get('openapi')!.checks.find((entry) => entry.name === 'openapi/stale-document')!;
    const input = buildCheckInput(session, check.name, { scope });
    const { mode } = await stat(document);
    return { document, edited, mode, check, input };
}

// The dirty document, the untracked file, and the absence of generator side effects, whatever the generator did.
async function expectPreserved(root: string, { document, edited, mode, input }: OpenapiProject): Promise<void> {
    expect(await readFile(document, 'utf8')).toBe(edited);
    const current = await stat(document);
    expect(current.mode).toBe(mode);
    expect(await readFile(join(root, input.scope, 'notes.txt'), 'utf8')).toBe('Untracked project notes\n');
    expect(await pathExists(join(root, input.scope, 'side-effect.txt'))).toBe(false);
}

test.each(['', 'apps/api'])(
    'OpenAPI freshness in %s reports failed generation and preserves dirty and untracked input',
    async (scope) => {
        await using directory = await testdir();
        const testRepository = await applyChanges(directory.path, '{"fail":true}\n', scope);
        expect(await rejection(BUILT_IN_CHECKS['supabase/stale-types'].input(testRepository.input))).toContain(
            'Generation failed',
        );
        await expectPreserved(directory.path, testRepository);
    },
);

test.each(['', 'apps/api'])(
    'OpenAPI freshness in %s reports stale output, accepts regeneration, and preserves input',
    async (scope) => {
        await using directory = await testdir();
        const testRepository = await applyChanges(directory.path, '{"version":3}\n', scope);
        expect(await BUILT_IN_CHECKS['supabase/stale-types'].input(testRepository.input)).toStrictEqual([
            {
                check: testRepository.check.name,
                file: posix.join(scope, 'openapi.json'),
                line: 1,
                rule: 'stale',
                message: textContaining('["bun","generate.ts","","two words"]'),
                fixable: false,
            },
        ]);
        await writeFile(join(directory.path, scope, 'schema.json'), testRepository.edited);
        expect(await BUILT_IN_CHECKS['supabase/stale-types'].input(testRepository.input)).toStrictEqual([]);
        await expectPreserved(directory.path, testRepository);
    },
);

test.each(['', 'apps/api'])(
    'OpenAPI freshness in %s identifies a missing configured document before starting a tool',
    async (scope) => {
        await using sandbox = await testdir();
        const table =
            scope === '' ? '[openapi]' : `[scope."${scope}"]\nconfigurations = ["openapi"]\n[scope."${scope}".openapi]`;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['openapi'], {
                tables: `${table}\ndocument = "openapi.json"\ngenerate_command = ["bun", "generate.ts"]\n`,
            }),
            [posix.join(scope, 'generate.ts')]: 'export {};',
        });
        const input = buildCheckInput(await openSession(sandbox.path), 'openapi/stale-document', { scope });
        using spawn = spyOn(processes, 'run');
        expect(await rejection(BUILT_IN_CHECKS['supabase/stale-types'].input(input))).toBe(
            `The openapi.document setting names ${posix.join(scope, 'openapi.json')}, which does not exist.`,
        );
        expect(spawn).not.toHaveBeenCalled();
        expect(await pathExists(join(sandbox.path, scope, 'openapi.json'))).toBe(false);
    },
);

test.each(SPECTRAL_SCOPES)(
    'Spectral at %s in %s uses the project document and its generated ruleset',
    async (level, scope) => {
        await using sandbox = await testdir();
        const table =
            scope === '' ? '[openapi]' : `[scope."${scope}"]\nconfigurations = ["openapi"]\n[scope."${scope}".openapi]`;
        const document = '{"openapi":"3.1.0"}';
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['openapi'], { level, tables: `${table}\ndocument = "openapi.json"\n` }),
            [posix.join(scope, 'openapi.json')]: document,
        });
        const applied = await runGspot(sandbox.path, ['apply', '--json']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const session = await openSession(sandbox.path);
        const planned = planRun(session, { stage: 'all', only: ['openapi/spectral'], skips: [] });
        const check = planned.find((entry) => entry.scope.scope.path === scope)!;
        expect(check.skip).toBeUndefined();
        const pin = toolPin(session.manifests.values(), 'spectral');
        await createFileTree(sandbox.path, {
            '.gspot/node_modules/.bin/spectral': 'fixture',
            '.gspot/node_modules/@stoplight/spectral-cli/package.json': JSON.stringify({
                name: pin.installers['npm']!.name,
                version: pin.version,
            }),
        });
        using _pins = mockPinnedExecutables([pin]);
        using spawn = spyOn(processes, 'run').mockImplementation(() =>
            Promise.resolve({
                ...SPECTRAL_RESULT,
                stdout: `${posix.join(scope, 'openapi.json')}:1:1 error missing-schema "Missing schema"`,
            }),
        );
        expect(await runCheckCommand(session, check)).toMatchObject({
            status: 'failed',
            findings: [{ file: posix.join(scope, 'openapi.json'), ...SPECTRAL_FINDING }],
        });
        expect(spawn.mock.calls.map(([, options]) => options.cwd)).toStrictEqual([sandbox.path]);
        expect(spawn.mock.calls.map(([argv]) => argv.slice(1))).toStrictEqual([
            [
                'lint',
                '--ruleset',
                join(sandbox.path, '.gspot/config/spectral.yaml'),
                '--format',
                'text',
                posix.join(scope, 'openapi.json'),
            ],
        ]);
        expect(await readFile(join(sandbox.path, scope, 'openapi.json'), 'utf8')).toBe(document);
        await unlink(join(sandbox.path, scope, 'openapi.json'));
        spawn.mockResolvedValueOnce(SPECTRAL_MISSING_DOCUMENT);
        const missing = await runCheckCommand(session, check);
        expect(missing.status).toBe('error');
        expect(missing.note).toContain(SPECTRAL_MISSING_DOCUMENT.stderr);
        expect(await pathExists(join(sandbox.path, scope, 'openapi.json'))).toBe(false);
    },
);
