import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { matchFields } from '#tests/setup/matchers.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getShippedCheck } from '#tests/setup/cli/configurations.ts';
import { BUN_PROJECT_FILES } from '#tests/config/checks/general/dependencies.ts';

test('react-versions reports react and react-dom that lock different versions, and nothing when they match', async () => {
    await using sandbox = await testdir({
        ...BUN_PROJECT_FILES,
        'gspot.toml': buildSandboxSettings(['react-dom']),
    });
    expect(await runSandboxCheck(sandbox.path, 'react-dom/react-versions')).toStrictEqual([
        {
            check: 'react-dom/react-versions',
            fixable: false,
            help: getShippedCheck('react-dom/react-versions').help,
            file: 'package.json',
            line: 1,
            rule: 'react-versions',
            message:
                'react 19.1.0 and react-dom 19.0.0 differ, and React stops at run time when they do. Install the same version of both.',
        },
    ]);
    for (const [path, text] of Object.entries(BUN_PROJECT_FILES))
        await writeFile(join(sandbox.path, path), text.replaceAll('19.0.0', '19.1.0'));
    expect(await runSandboxCheck(sandbox.path, 'react-dom/react-versions')).toStrictEqual([]);
});

test('react-versions ignores an older React installed privately by another dependency', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['react-dom']),
        'package.json': '{"dependencies":{"react":"18.3.1","react-dom":"18.3.1"}}',
        'package-lock.json':
            '{"lockfileVersion":3,"packages":{"":{"dependencies":{"react":"18.3.1","react-dom":"18.3.1"}},"node_modules/react":{"version":"18.3.1"},"node_modules/react-dom":{"version":"18.3.1"},"node_modules/old-chart/node_modules/react":{"version":"17.0.2"}}}',
    });
    expect(await runSandboxCheck(sandbox.path, 'react-dom/react-versions')).toStrictEqual([]);
});

test('react-versions accepts intersecting ranges without a lockfile and reports disjoint ranges', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['react-dom']),
        'package.json': '{"dependencies":{"react":"^19.1.0","react-dom":"19.1.0"}}',
    });
    expect(await runSandboxCheck(sandbox.path, 'react-dom/react-versions')).toStrictEqual([]);
    await writeFile(join(sandbox.path, 'package.json'), '{"dependencies":{"react":"^18.0.0","react-dom":"^19.0.0"}}');
    expect(await runSandboxCheck(sandbox.path, 'react-dom/react-versions')).toEqual([
        matchFields({ file: 'package.json', rule: 'react-versions' }),
    ]);
});
