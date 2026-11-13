import { readFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import { parse } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { openSession } from '#cli/engine/session.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { readPythonSettings } from '#cli/tools/installers/python/indexes.ts';
import { isPythonLockfileFresh } from '#cli/tools/installers/python/lockfiles.ts';
import { installPythonTools } from '#cli/tools/installers/python/project.ts';
import type { PythonToolProject } from '#cli/types/tools.ts';
import {
    INVALID_UV_SETTINGS,
    PYPROJECT_UV_INDEX,
    PYTHON_TOOL_LOCKFILE,
    PYTHON_TOOL_PROJECT,
    UV_TOML,
} from '#tests/config/tools.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildSandboxToolInstall } from '#tests/setup/cli/tools.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

const pythonProject = (parse(PYTHON_TOOL_PROJECT) as { project: PythonToolProject }).project;

async function readInstalledSettings(root: string, releaseAgeDays: number): Promise<unknown> {
    const settings: unknown[] = [];
    using _boundary = fakeCommands('settings-uv', (command) => {
        const file = command[command.indexOf('--config-file') + 1];
        if (file === undefined) throw new Error('The uv command received no settings file.');
        settings.push(parse(readFileSync(file, 'utf8')));
        return Promise.resolve(buildProcessResult());
    });
    await installPythonTools(
        { ...(await buildSandboxToolInstall(await openSession(root))), releaseAgeDays },
        'settings-uv',
    );
    expect(settings).toHaveLength(1);
    return settings[0];
}

test.each(INVALID_UV_SETTINGS)(
    'invalid $file $field settings name the file and field',
    async ({ file, field, text }) => {
        await using sandbox = await testdir({ [file]: text });
        expect(() => readPythonSettings(sandbox.path)).toThrow(
            matchFields<GspotError>({
                name: 'GspotError',
                code: 'parse',
                message: expect.stringContaining(`${file}: ${field}`) as string,
            }),
        );
    },
);

test('uv.toml wins and local index paths are read relative to the repository', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'uv.toml': UV_TOML,
        'pyproject.toml': PYPROJECT_UV_INDEX,
    });
    expect(readPythonSettings(sandbox.path).credentials).toStrictEqual(['test%2Bpassword', 'test+password']);
    expect(await readInstalledSettings(sandbox.path, 7)).toStrictEqual({
        'exclude-newer': '7 days',
        'index-url': 'https://alex:test%2Bpassword@example.com/simple',
        'find-links': [join(sandbox.path, 'wheels'), 'https://example.com/wheels'],
        offline: true,
        index: [{ name: 'local', url: join(sandbox.path, 'packages') }],
    });
});

test('project index settings apply only without uv.toml, and missing or empty files give none', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'pyproject.toml': PYPROJECT_UV_INDEX,
    });
    expect(await readInstalledSettings(sandbox.path, 7)).toStrictEqual({
        'exclude-newer': '7 days',
        'index-url': 'https://example.com/simple',
        'find-links': [join(sandbox.path, 'wheels')],
    });
    await createFileTree(sandbox.path, { 'uv.toml': '' });
    expect(await readInstalledSettings(sandbox.path, 7)).toStrictEqual({
        'exclude-newer': '7 days',
    });
    await rm(join(sandbox.path, 'uv.toml'));
    await rm(join(sandbox.path, 'pyproject.toml'));
    expect(await readInstalledSettings(sandbox.path, 7)).toStrictEqual({
        'exclude-newer': '7 days',
    });
});

test('Python resolution excludes releases newer than the minimum release age', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    expect(await readInstalledSettings(sandbox.path, 14)).toStrictEqual({
        'exclude-newer': '14 days',
    });
    const saved = `${PYTHON_TOOL_LOCKFILE}\n[options]\nexclude-newer-span = "P7D"\n`;
    expect(isPythonLockfileFresh(pythonProject, saved, {}, 7)).toBe(true);
    expect(isPythonLockfileFresh(pythonProject, saved, {}, 14)).toBe(false);
});
