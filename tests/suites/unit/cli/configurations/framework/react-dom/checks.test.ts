import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { matchFields } from '#tests/setup/matchers.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { BUN_PROJECT_FILES } from '#tests/config/configurations/general.ts';

test('react-versions reports react and react-dom that lock different versions, and nothing when they match', async () => {
    await using sandbox = await createGitSandbox({
        ...BUN_PROJECT_FILES,
        'gspot.toml': buildSandboxSettings(['react-dom']),
    });
    expect(await runSandboxCheck(sandbox.path, 'react-dom/react-versions')).toStrictEqual([
        expect.objectContaining({
            file: 'package.json',
            line: 1,
            rule: 'react-versions',
            message: expect.stringContaining('react 19.1.0 and react-dom 19.0.0') as string,
        }),
    ]);
    for (const [path, text] of Object.entries(BUN_PROJECT_FILES))
        await writeFile(join(sandbox.path, path), text.replaceAll('19.0.0', '19.1.0'));
    expect(await runSandboxCheck(sandbox.path, 'react-dom/react-versions')).toStrictEqual([]);
});

test('react-versions accepts intersecting ranges without a lockfile and reports disjoint ranges', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['react-dom']),
        'package.json': '{"dependencies":{"react":"^19.1.0","react-dom":"19.1.0"}}',
    });
    expect(await runSandboxCheck(sandbox.path, 'react-dom/react-versions')).toStrictEqual([]);
    await writeFile(join(sandbox.path, 'package.json'), '{"dependencies":{"react":"^18.0.0","react-dom":"^19.0.0"}}');
    expect(await runSandboxCheck(sandbox.path, 'react-dom/react-versions')).toEqual([
        matchFields({ file: 'package.json', rule: 'react-versions' }),
    ]);
});
