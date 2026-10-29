import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/planning/session.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { listExpectedPaths, listOutdatedFiles } from '#cli/generation/outdated.ts';

test('changed managed keys are reported without a whole-file replacement', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"stylelint":"authored"}\n',
    });
    const session = await openSession(sandbox.path);
    const output = {
        files: [],
        blocks: [],
        managedKeys: [{ path: 'package.json', keys: [{ key: ['stylelint'], value: 'managed' }] }],
    };
    expect(await listOutdatedFiles(session, output)).toStrictEqual([{ path: 'package.json', kind: 'changed' }]);
});

test('the expected paths keep the lockfile of the generated mise project', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings([]) });
    const session = await openSession(sandbox.path);
    const output = { files: [{ path: '.gspot/mise.toml', content: '[tools]\n' }], blocks: [], managedKeys: [] };
    expect([...listExpectedPaths(session, output)]).toStrictEqual(['.gspot/mise.toml', '.gspot/mise.lock']);
});
