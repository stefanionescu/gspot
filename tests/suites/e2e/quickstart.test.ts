import { test, expect } from 'bun:test';
import { join, dirname } from 'node:path';
import { parse } from '@decimalturn/toml-patch';
import { testdir, createFileTree } from 'testdirs';
import cliPackage from '#cli-package' with { type: 'json' };
import { runtimePinsSchema } from '#tests/schemas/runner.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { TOOL_PINS_FILE } from '#tests/config/setup/runner.ts';
import { hasToolBuild } from '#tests/setup/system/platform.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { REPOSITORY_ROOT } from '#tests/setup/runner/run-folder.ts';
import { listFindingRows, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { SWIFT_TUTORIAL, PYTHON_TUTORIAL } from '#tests/config/e2e/quickstart.ts';
import { runCommand, runCommandBlocking } from '#tests/setup/system/processes.ts';

test('the Python quickstart reports its finding through the installed hook and passes after the fix', async () => {
    await runQuickstart(PYTHON_TUTORIAL);
});

test.skipIf(!hasToolBuild('swiftlint') || Bun.which('swift') === null)(
    'the Swift quickstart reports its finding through the installed hook and passes after the fix',
    async () => {
        await runQuickstart(SWIFT_TUTORIAL);
    },
);

async function runQuickstart(tutorial: typeof PYTHON_TUTORIAL | typeof SWIFT_TUTORIAL): Promise<void> {
    await using sandbox = await testdir();
    const root = join(sandbox.path, tutorial.folder);
    await mkdir(root);
    const environment = {
        MISE_CONFIG_DIR: join(sandbox.path, 'config'),
        MISE_DATA_DIR: join(sandbox.path, 'data'),
        MISE_STATE_DIR: join(sandbox.path, 'state'),
        MISE_CACHE_DIR: join(sandbox.path, 'cache'),
        MISE_CEILING_PATHS: dirname(root),
    };
    const runtimePins = runtimePinsSchema.parse(
        parse(await readFile(join(REPOSITORY_ROOT, TOOL_PINS_FILE), 'utf8')),
    ).tools;
    for (const command of [
        ['mise', 'use', `node@${runtimePins.node}`, `npm:@gspothq/cli@${cliPackage.version}`],
        ...tutorial.projectCommands,
    ]) {
        const created = await runCommand([...command], { cwd: root, env: environment });
        expect(created.code, created.stdout + created.stderr).toBe(0);
    }
    await createFileTree(root, tutorial.files);
    commitAll(root);
    const gspotCommand = ['mise', 'exec', '--', 'gspot'];
    for (const { gspotArguments, code } of [
        { gspotArguments: ['init', '--yes'], code: 0 },
        { gspotArguments: ['install'], code: 0 },
        { gspotArguments: ['check'], code: tutorial.firstCheckCode },
        { gspotArguments: ['check', '--fix'], code: 0 },
        { gspotArguments: ['check'], code: 0 },
    ]) {
        const command = [...gspotCommand, ...gspotArguments];
        const result = await runCommand(command, { cwd: root, env: environment });
        expect(result.code, `${command.join(' ')}\n${result.stdout}${result.stderr}`).toBe(code);
    }
    const source = join(root, tutorial.sourcePath);
    runGitStep(root, ['add', '-A']);
    const committed = runCommandBlocking(['git', 'commit', '-qm', 'chore: Set up gspot'], {
        cwd: root,
        env: environment,
    });
    expect(committed.code, committed.stdout + committed.stderr).toBe(0);
    await writeFile(source, tutorial.invalidSource);
    const command = [...gspotCommand, 'check', '--only', tutorial.check, '--json'];
    const rejected = await runCommand(command, { cwd: root, env: environment });
    expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
    expect(listFindingRows(parseCheckReport(rejected).report)).toStrictEqual([
        { file: tutorial.sourcePath, line: tutorial.line, rule: tutorial.rule },
    ]);
    assertCommitRejected(root, tutorial.rule, environment);
    runGitStep(root, ['restore', '--source=HEAD', '--staged', '--worktree', '--', tutorial.sourcePath]);
    const corrected = await runCommand(command, { cwd: root, env: environment });
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
}

function assertCommitRejected(root: string, rule: string, environment: Record<string, string>): void {
    runGitStep(root, ['add', '-A']);
    const refused = runCommandBlocking(['git', 'commit', '-qm', 'feat: Add invalid source'], {
        cwd: root,
        env: environment,
    });
    expect(refused.code, refused.stdout + refused.stderr).toBe(1);
    expect(refused.stdout + refused.stderr).toContain(rule);
}
