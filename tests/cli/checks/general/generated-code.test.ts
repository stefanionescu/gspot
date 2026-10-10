import { join, posix } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { planRun } from '#cli/planning/public.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/public.ts';
import { symlink, readFile } from 'node:fs/promises';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { BUILT_IN_CALCULATIONS } from '#cli/checks/public.ts';
import { prepareCommand, commandEnvironment } from '#cli/execution/command/public.ts';
import { GENERATED_SCOPES } from '#tests/config/cli/checks/general/generated-code.ts';

test.each(GENERATED_SCOPES)('unmatched generated patterns at %s in %s do not start a tool', async (level, scope) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(scope === '' ? ['cloudflare'] : [], {
            level,
            tables: scope === '' ? '' : `[scope."${scope}"]\nconfigurations = ["cloudflare"]\n`,
        }),
        [join(scope, 'source.ts')]: 'export {};\n',
    });
    const input = buildCheckInput(await openSession(sandbox.path), 'cloudflare/stale-types', { scope });
    using run = spyOn(processes, 'run');
    expect(await BUILT_IN_CALCULATIONS['supabase/stale-types'](input)).toStrictEqual([]);
    expect(run).not.toHaveBeenCalled();
    expect(await readFile(join(sandbox.path, scope, 'source.ts'), 'utf8')).toBe('export {};\n');
});

test.each(GENERATED_SCOPES)(
    'whole-setting generator argv at %s in %s retain empty and multiword entries',
    async (level, scope) => {
        await using sandbox = await testdir();
        const table =
            scope === '' ? '[openapi]' : `[scope."${scope}"]\nconfigurations = ["openapi"]\n[scope."${scope}".openapi]`;
        const argv = ['bun', 'generate.ts', '', 'two words'];
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(scope === '' ? ['openapi'] : [], {
                level,
                tables: `${table}\ndocument = "openapi.json"\ngenerate_command = ${JSON.stringify(argv)}\n`,
            }),
            [join(scope, 'openapi.json')]: '{}\n',
        });
        const session = await openSession(sandbox.path);
        const input = buildCheckInput(session, 'openapi/stale-document', { scope });
        const planned = planRun(session, { stage: 'push', only: ['openapi/stale-document'], skips: [] }).find(
            (entry) => entry.scope.scope.path === scope,
        )!;
        const environment = commandEnvironment(session, planned);
        expect(prepareCommand(session, planned, input.check.command!, environment).commands[0]?.argv).toStrictEqual(
            argv,
        );
        expect(() =>
            prepareCommand(session, planned, ['prefix{setting:openapi.generate_command}'], environment),
        ).toThrow('List setting openapi.generate_command must occupy a whole command argument.');
        input.selection.view.settings['openapi.generate_command'] = [];
        expect(prepareCommand(session, planned, input.check.command!, environment).commands[0]?.argv).toStrictEqual([]);
        expect(await BUILT_IN_CALCULATIONS['supabase/stale-types'](input)).toStrictEqual([]);
    },
);

test.each(GENERATED_SCOPES)(
    'required generated paths at %s in %s refuse escaping authored links before execution',
    async (level, scope) => {
        await using sandbox = await testdir();
        await using external = await testdir();
        await createFileTree(external.path, { 'outside.json': '{}\n' });
        const table =
            scope === '' ? '[openapi]' : `[scope."${scope}"]\nconfigurations = ["openapi"]\n[scope."${scope}".openapi]`;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(scope === '' ? ['openapi'] : [], {
                level,
                tables: `${table}\ndocument = "openapi.json"\ngenerate_command = ["bun", "generate.ts"]\n`,
            }),
            [join(scope, 'generate.ts')]: 'export {};\n',
        });
        await symlink(join(external.path, 'outside.json'), join(sandbox.path, scope, 'openapi.json'), 'file');
        const input = buildCheckInput(await openSession(sandbox.path), 'openapi/stale-document', { scope });
        using run = spyOn(processes, 'run');
        expect(await rejection(BUILT_IN_CALCULATIONS['supabase/stale-types'](input))).toContain('leaves');
        expect(run).not.toHaveBeenCalled();
        expect(await readFile(join(external.path, 'outside.json'), 'utf8')).toBe('{}\n');
    },
);

test.each(GENERATED_SCOPES)(
    'generated binary source links at %s in %s remain contained, cached, and unchanged',
    async (level, scope) => {
        await using sandbox = await testdir();
        const table =
            scope === '' ? '[openapi]' : `[scope."${scope}"]\nconfigurations = ["openapi"]\n[scope."${scope}".openapi]`;
        const bytes = Buffer.from([0, 255, 127]);
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(scope === '' ? ['openapi'] : [], {
                level,
                tables: `${table}\ndocument = "openapi.json"\ngenerate_command = ["bun", "generate.ts"]\n`,
            }),
            [join(scope, 'body.bin')]: bytes,
            [join(scope, 'generate.ts')]: 'export {};\n',
        });
        await symlink('body.bin', join(sandbox.path, scope, 'openapi.json'), 'file');
        const input = buildCheckInput(await openSession(sandbox.path), 'openapi/stale-document', { scope });
        using run = spyOn(processes, 'run').mockResolvedValue({
            code: 0,
            missing: false,
            stdout: '',
            stderr: '',
            duration: 1,
        });
        expect(await BUILT_IN_CALCULATIONS['supabase/stale-types'](input)).toStrictEqual([]);
        expect(run).toHaveBeenCalledTimes(1);
        expect(input.reads.sources.get(posix.join(scope, 'openapi.json'))).toStrictEqual(bytes);
        expect(await readFile(join(sandbox.path, scope, 'body.bin'))).toStrictEqual(bytes);
        expect(await readFile(join(sandbox.path, scope, 'openapi.json'))).toStrictEqual(bytes);
    },
);
