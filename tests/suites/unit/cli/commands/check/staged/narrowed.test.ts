import { appendFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { compareText } from '#cli/system/text.ts';
import { parseCheckReport, runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';

const CHECKS = 'docs/missing-paths,bash/unread-arguments';

async function listStagedFindings(root: string, paths: string[]): Promise<string[]> {
    runGitStep(root, ['add', ...paths]);
    const run = parseCheckReport(await runGspot(root, ['check', '--staged', '--only', CHECKS, '--json']));
    return run.report.checks.flatMap(({ findings }) => findings.map(({ file }) => file)).toSorted(compareText);
}

test('a commit reports an old finding only in a file that it stages or a change that causes it', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['docs', 'bash'], { level: 'basic' }),
        'README.md': '# Example\n\nRead `src/missing.ts`.\n',
        'notes.txt': 'first\n',
        'scripts/lib.sh': '#!/usr/bin/env bash\nsay() {\n    printf "hello\\n"\n}\n',
        'scripts/run.sh': '#!/usr/bin/env bash\n# shellcheck source=scripts/lib.sh\nsource scripts/lib.sh\nsay one\n',
    });
    await applyGeneratedFiles(sandbox.path);
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'notes.txt'), 'second\n');
    expect(await listStagedFindings(sandbox.path, ['notes.txt'])).toStrictEqual([]);
    await appendFile(join(sandbox.path, 'scripts/run.sh'), 'say two\n');
    expect(await listStagedFindings(sandbox.path, ['scripts/run.sh'])).toStrictEqual(['scripts/lib.sh']);
    runGitStep(sandbox.path, ['reset', '--quiet']);
    await appendFile(join(sandbox.path, 'README.md'), '\nMore.\n');
    expect(await listStagedFindings(sandbox.path, ['README.md'])).toStrictEqual(['README.md']);
});

test('a staged deletion of .mise/tasks/lint reports the document that names its task', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['docs', 'bash'], { level: 'basic' }),
        'README.md': '# Example\n\nRun `mise run lint`.\n',
        'mise.toml': '[tasks.test]\nrun = "true"\n',
        '.mise/tasks/lint': '#!/usr/bin/env bash\n',
    });
    await applyGeneratedFiles(sandbox.path);
    commitAll(sandbox.path);
    await rm(join(sandbox.path, '.mise/tasks/lint'));
    expect(await listStagedFindings(sandbox.path, ['.mise/tasks/lint'])).toStrictEqual(['README.md']);
});
