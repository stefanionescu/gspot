import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from '@decimalturn/toml-patch';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('setting environment readers enables a restriction without a loosening reason', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python'], { level: 'all' }),
        'environment.py': 'import os\nPORT = os.environ["PORT"]\n',
    });
    const command = ['set', 'structure.environment_readers', 'environment.py'];
    const result = await runGspot(sandbox.path, command);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const saved = await readFile(join(sandbox.path, 'gspot.toml'), 'utf8');
    expect(parse(saved)).toHaveProperty('structure.environment_readers', ['environment.py']);
});
