import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { parseCheckReport, spawnGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { linkTypescript } from '#tests/setup/sandboxes/node-modules.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll } from '#tests/setup/system/git.ts';

async function runInstalledTsc(root: string): Promise<ReturnType<typeof parseCheckReport>['report']> {
    await linkTypescript(join(root, 'node_modules'));
    commitAll(root);
    await applyGeneratedFiles(root);
    return parseCheckReport(await spawnGspot(root, ['check', '--only', 'typescript/tsc', '--json'])).report;
}

test('typescript/tsc adds a note when a missing module is a package of this repository', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript']),
        '.gitignore': 'node_modules/\n',
        'package.json': '{"name":"root","private":true,"workspaces":["packages/*"]}',
        'tsconfig.json': '{"compilerOptions":{"strict":true,"module":"esnext","moduleResolution":"bundler"}}',
        'packages/shared/package.json': '{"name":"@example/shared","exports":"./dist/index.js"}',
        'entry.ts': 'import { value } from "@example/shared/values";\n\nexport const copy: number = value;\n',
    });
    const report = await runInstalledTsc(sandbox.path);
    expect(report.checks[0]).toMatchObject({
        status: 'failed',
        note: expect.stringContaining('@example/shared is a package of this repository') as string,
    });
});
