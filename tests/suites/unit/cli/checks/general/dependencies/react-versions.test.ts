import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { matchFields } from '#tests/setup/matchers.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { BUN_PROJECT_FILES, MATCHED_REACT_FILES } from '#tests/config/checks/general/dependencies.ts';

test('react-versions reports react and react-dom that lock different versions, and nothing when they match', async () => {
    await using sandbox = await testdir({
        ...BUN_PROJECT_FILES,
        'gspot.toml': buildSandboxSettings(['react-dom']),
    });
    expect(await runSandboxCheck(sandbox.path, 'react-dom/react-versions')).toStrictEqual([
        matchFields({
            file: 'package.json',
            line: 1,
            rule: 'react-versions',
            message:
                'react 19.1.0 and react-dom 19.0.0 differ, and React stops at run time when they do. Install the same version of both.',
        }),
    ]);
    for (const [path, text] of Object.entries(MATCHED_REACT_FILES)) await writeFile(join(sandbox.path, path), text);
    expect(await runSandboxCheck(sandbox.path, 'react-dom/react-versions')).toStrictEqual([]);
});
