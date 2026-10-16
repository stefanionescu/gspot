import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { isOnDisk } from '#tests/setup/files.ts';
import { matchItems } from '#tests/setup/matchers.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { readFile, writeFile } from 'node:fs/promises';
import type { InitJson } from '#cli/types/commands/init.ts';
import type { RunReport } from '#cli/types/checks/run/check.ts';
import { buildSpawnEnvironment } from '#cli/system/environment.ts';
import { setUpPackedSandbox, createPackedSandbox } from '#tests/setup/packed-sandbox.ts';
import { STARTING_FILES, CLAUDE_REFERENCE_BLOCK, SHELLCHECK_SYNTAX_FINDINGS } from '#tests/data/packed-install.ts';

// Assert the delivered takeover contract before inspecting the check report.
async function assertReplacedFiles(root: string, output: string): Promise<void> {
    expect((JSON.parse(output) as InitJson).plan?.delete.map(({ path }) => path)).toStrictEqual([
        'prettier.config.mjs',
        '.editorconfig',
    ]);
    expect({
        settings: await isOnDisk(join(root, 'gspot.toml')),
        formatter: await isOnDisk(join(root, 'prettier.config.mjs')),
        instructions: await isOnDisk(join(root, 'CLAUDE.md')),
    }).toStrictEqual({ settings: true, formatter: false, instructions: true });
    expect(await readFile(join(root, 'CLAUDE.md'), 'utf8')).toBe(CLAUDE_REFERENCE_BLOCK + STARTING_FILES['CLAUDE.md']);
    const agents = await readFile(join(root, 'AGENTS.md'), 'utf8');
    expect({
        teamNotes: agents.startsWith('# Team notes\n'),
        ruleLink: agents.includes('WORKING.md'),
    }).toStrictEqual({ teamNotes: true, ruleLink: true });
}

test('init replaces formatter files, links CLAUDE.md to AGENTS.md, keeps your notes, and check reports findings', async () => {
    await using consumer = await createPackedSandbox();
    const { root } = consumer;
    await createFileTree(root, STARTING_FILES);
    const initialized = await setUpPackedSandbox(consumer, {
        cwd: consumer.root,
        configurations: ['bash', 'python', 'swift'],
    });
    await assertReplacedFiles(root, initialized.stdout);
    expect(initialized.stdout).not.toContain('formatter stdout');
    const checked = await runCommand(
        [
            ...consumer.command,
            'check',
            '--only',
            'bash/shellcheck',
            'dependencies/lockfiles',
            'format/prettier',
            '--json',
        ],
        consumer.offlineOptions,
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const { checks, exitCode } = JSON.parse(checked.stdout) as RunReport;
    expect(exitCode).toBe(1);
    expect(checks).toHaveLength(3);
    expect(checks.filter(({ status }) => status === 'error' || status === 'missing')).toStrictEqual([]);
    // The throwaway registry serves HTTP archives, which the consumer lockfile must report.
    const lockfileHosts = checks.find(({ check }) => check === 'dependencies/lockfiles')!.findings;
    expect(lockfileHosts.length).toBeGreaterThan(0);
    for (const finding of lockfileHosts) {
        expect(finding).toMatchObject({ file: 'package-lock.json', rule: 'host' });
        expect(finding.message).toContain(new URL('/', buildSpawnEnvironment()['GSPOT_TEST_NPM_REGISTRY']).href);
    }
    expect(
        checks.flatMap(({ check, status, findings }) =>
            findings.map(({ file, line }) => ({ check, status, file, line })),
        ),
    ).toEqual(matchItems([{ check: 'format/prettier', status: 'failed', file: 'source.js', line: undefined }]));
    expect(checks.find(({ check }) => check === 'bash/shellcheck')).toMatchObject({
        status: 'failed',
        fileCount: 1,
        findings: SHELLCHECK_SYNTAX_FINDINGS,
    });
    await writeFile(join(root, 'broken.sh'), 'echo example\n');
    const corrected = await runCommand(
        [...consumer.command, 'check', '--only', 'bash/shellcheck', '--json'],
        consumer.offlineOptions,
    );
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const clean = JSON.parse(corrected.stdout) as RunReport;
    expect(clean.exitCode).toBe(0);
    expect(clean.skips).toStrictEqual([]);
    expect(clean.checks).toHaveLength(1);
    expect(clean.checks[0]).toMatchObject({ check: 'bash/shellcheck', status: 'passed', fileCount: 1, findings: [] });
    expect(await readFile(join(root, 'authored.txt'), 'utf8')).toBe(STARTING_FILES['authored.txt']);
});
