import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { selectStartRunner } from '#cli/repository/projects/runner.ts';

test('the pnpm install of gspot names the workspace root, because pnpm refuses a plain add there', async () => {
    const packageJson = JSON.stringify({
        packageManager: 'pnpm@10.16.0',
        devDependencies: { '@gspothq/cli': '0.0.0-test' },
    });
    await using workspace = await testdir({
        'package.json': packageJson,
        'pnpm-workspace.yaml': 'packages:\n  - packages/*\n',
    });
    await using single = await testdir({ 'package.json': packageJson });
    expect(selectStartRunner(workspace.path).installCommand).toContain('--workspace-root');
    expect(selectStartRunner(single.path).installCommand).not.toContain('--workspace-root');
});
