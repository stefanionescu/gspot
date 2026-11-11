import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { getTool, readConfigurations } from '#cli/manifests/read.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands, fakeToolExecutables } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

test('osv-scanner reads each lockfile of the repository at any size, apart from ignored folders and the files of gspot', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: '[repository]\nmax_file_kilobytes = 0\n' }),
        'uv.lock': 'version = 1\n',
        'app/requirements.txt': '',
        '.gspot/bun.lock': '',
        '.claude/worktrees/copy/uv.lock': '',
        '.claude/worktrees/copy/.gspot/bun.lock': '',
    });
    await writeFile(join(sandbox.path, '.git/info/exclude'), '.claude/worktrees/\n');
    await applyGeneratedFiles(sandbox.path);
    using _pins = fakeToolExecutables([getTool(readConfigurations().values(), 'osv-scanner')]);
    using _spawn = fakeCommands('osv-scanner', (command, options) => {
        const results = command
            .filter((argument) => argument.startsWith('--lockfile=:'))
            .map((argument) => ({
                source: { path: join(options.cwd, argument.slice('--lockfile=:'.length)), type: 'lockfile' },
                packages: [
                    {
                        package: { name: 'django', version: '2.0.0', ecosystem: 'PyPI' },
                        vulnerabilities: [{ id: 'GHSA-1', summary: 'Denial of service.' }],
                    },
                ],
            }));
        return Promise.resolve(buildProcessResult({ code: 1, stdout: JSON.stringify({ results }) }));
    });
    const findings = await runSandboxCheck(sandbox.path, 'dependencies/osv-scanner');
    expect(findings.map(({ file }) => file)).toStrictEqual(['app/requirements.txt', 'uv.lock']);
});
