import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { join, delimiter } from 'node:path';
import { fakeTool } from '#tests/setup/fakes.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { RELEASE_TAGS, RELEASE_RETRY_CASES, RELEASE_COMMAND_FAKE } from '#tests/data/release.ts';

test.each(RELEASE_RETRY_CASES)('release completes and can run again when $name', async (initial) => {
    await using sandbox = await testdir({
        'packages/eslint-plugin/package.json': '{"name":"@example/plugin","version":"0.0.0-test"}',
        'packages/cli/package.json': '{"name":"@example/cli","version":"0.0.0-test"}',
        'state.json': JSON.stringify({ ...initial, calls: [] }),
    });
    for (const name of ['git', 'npm', 'gh', 'mise', 'bun'])
        await fakeTool(sandbox.path, `bin/${name}`, RELEASE_COMMAND_FAKE);
    const task = fileURLToPath(new URL('../../.mise/tasks/release', import.meta.url));
    const options = {
        cwd: sandbox.path,
        env: {
            PATH: [join(sandbox.path, 'bin'), readEnvironmentVariable('PATH') ?? ''].join(delimiter),
            GSPOT_RELEASE_STATE: join(sandbox.path, 'state.json'),
        },
    };
    const released = await runCommand(['bash', task], options);
    expect(released.code, released.stdout + released.stderr).toBe(0);
    const repeated = await runCommand(['bash', task], options);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
    const state: unknown = JSON.parse(await readFile(join(sandbox.path, 'state.json'), 'utf8'));
    expect(state).toMatchObject({
        published: ['@example/plugin', '@example/cli'],
        localTags: RELEASE_TAGS,
        remoteTags: RELEASE_TAGS,
        release: true,
    });
});

test('release asks GitHub to generate notes from the published commits', async () => {
    await using sandbox = await testdir({
        'packages/eslint-plugin/package.json': '{"name":"@example/plugin","version":"0.0.0-test"}',
        'packages/cli/package.json': '{"name":"@example/cli","version":"0.0.0-test"}',
        'state.json': JSON.stringify({ published: [], localTags: [], remoteTags: [], release: false, calls: [] }),
    });
    for (const name of ['git', 'npm', 'gh', 'mise', 'bun'])
        await fakeTool(sandbox.path, `bin/${name}`, RELEASE_COMMAND_FAKE);
    const task = fileURLToPath(new URL('../../.mise/tasks/release', import.meta.url));
    const result = await runCommand(['bash', task], {
        cwd: sandbox.path,
        env: {
            PATH: [join(sandbox.path, 'bin'), readEnvironmentVariable('PATH') ?? ''].join(delimiter),
            GSPOT_RELEASE_STATE: join(sandbox.path, 'state.json'),
        },
    });
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const state: unknown = JSON.parse(await readFile(join(sandbox.path, 'state.json'), 'utf8'));
    expect(state).toMatchObject({
        releaseArguments: [
            'release',
            'create',
            'v0.0.0-test',
            '--verify-tag',
            '--title',
            'v0.0.0-test',
            '--generate-notes',
        ],
    });
});
