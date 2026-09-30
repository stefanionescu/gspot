import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { TYPO } from '#tests/support/spelling.ts';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { initArgs } from '#tests/support/cli/init.ts';
import { toolsPath } from '#tests/support/cli/tools.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/inputs/cli.ts';
import { git, commitAll } from '#tests/support/cli/git.ts';
import { keptMode } from '#tests/support/cli/platforms.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { containing, containingAll } from '#tests/support/expectations.ts';
import { statSync, chmodSync, existsSync, renameSync, unlinkSync, readFileSync } from 'node:fs';

// Edited generated configuration is preserved; recovery restores the authored source and mode.
async function expectSpellingRestoration(
    root: string,
    environment: Record<string, string>,
    configuration: string,
    original: string,
): Promise<void> {
    const args = ['check', '--only', 'spelling/typos', '--no-cache', '--json'];
    chmodSync(join(root, '.gspot/config/typos.toml'), 0o644);
    await Bun.write(join(root, '.gspot/config/typos.toml'), '[default]\nlocale = "unknown"\n');
    const broken = await run(root, args, environment);
    expect(broken.code, broken.stdout + broken.stderr).toBe(2);
    const brokenReport = JSON.parse(broken.stdout) as RunReport;
    expect(brokenReport.checks).toStrictEqual(
        containingAll([containing({ check: 'spelling/typos', status: 'error', findings: [] })]),
    );
    const preserved = await run(root, ['apply'], environment);
    expect(preserved.code, preserved.stdout + preserved.stderr).toBe(2);
    expect(readFileSync(join(root, '.gspot/config/typos.toml'), 'utf8')).toContain('unknown');
    unlinkSync(join(root, '.gspot/config/typos.toml'));
    const restored = await run(root, ['apply'], environment);
    expect(restored.code, restored.stdout + restored.stderr).toBe(0);
    expect(readFileSync(join(root, '.gspot/config/typos.toml'), 'utf8')).toBe(configuration);
    const removed = await run(root, ['uninstall', '--yes'], environment);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(readFileSync(join(root, 'nested/typos.toml'), 'utf8')).toBe(original);
    expect(statSync(join(root, 'nested/typos.toml')).mode & 0o777).toBe(keptMode(0o640));
}

test(
    'spelling corrections return findings when an ambiguous word needs a manual choice',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(['spelling'], '[guides]\ninstall = false\n'),
            'sample.txt': `${TYPO.the} ${TYPO.whether}\n`,
        });
        const environment = { PATH: toolsPath(['typos']) };
        const applied = await run(sandbox.path, ['apply'], environment);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        commitAll(sandbox.path);
        const args = ['check', '--only', 'spelling/typos', '--no-cache', '--json', '--fix'];
        for (const attempt of [0, 1]) {
            const checked = await run(sandbox.path, args, environment);
            expect(checked.code, `Attempt ${String(attempt)}: ${checked.stdout}${checked.stderr}`).toBe(1);
            expect(readFileSync(join(sandbox.path, 'sample.txt'), 'utf8')).toBe(`the ${TYPO.whether}\n`);
            const report = JSON.parse(checked.stdout) as RunReport;
            expect(report.checks.flatMap((check) => check.findings)).toContainEqual(
                containing({ file: 'sample.txt', fixable: false }),
            );
        }
        await Bun.write(join(sandbox.path, 'sample.txt'), 'the whether\n');
        const corrected = await run(sandbox.path, args, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'spelling reports unusual filenames and Unicode columns, then accepts corrected content and filename',
    async () => {
        await using sandbox = await testdir();
        const paths = [
            'space name.txt',
            `${TYPO.the}.txt`,
            ...(process.platform === 'win32' ? [] : ['name:part.txt', 'line\nbreak.txt', 'tab\tname.txt']),
        ];
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(['spelling'], '[guides]\ninstall = false\n'),
            'the.txt': 'protected\n',
            ...Object.fromEntries(paths.map((path) => [path, `café ${TYPO.the}\n`])),
        });
        const environment = { PATH: toolsPath(['typos']) };
        const applied = await run(sandbox.path, ['apply'], environment);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        commitAll(sandbox.path);
        const args = ['check', '--only', 'spelling/typos', '--no-cache', '--json'];
        const checked = await run(sandbox.path, args, environment);
        expect(checked.code, checked.stdout + checked.stderr).toBe(1);
        const findings = (JSON.parse(checked.stdout) as RunReport).checks.flatMap((check) => check.findings);
        for (const path of paths)
            expect(findings).toContainEqual(containing({ file: path, line: 1, column: 6, fixable: true }));
        expect(findings).toContainEqual(
            containing({
                file: `${TYPO.the}.txt`,
                message: `Filename: \`${TYPO.the}\` should be \`the\``,
                fixable: false,
            }),
        );
        await Bun.write(join(sandbox.path, 'space name.txt'), `café ${TYPO.the} ${TYPO.the}\n`);
        expect(git(sandbox.path, ['add', '--', 'space name.txt']).code).toBe(0);
        await Bun.write(join(sandbox.path, 'space name.txt'), 'the\n');
        const staged = await run(sandbox.path, [...args, '--staged'], environment);
        expect(staged.code, staged.stdout + staged.stderr).toBe(1);
        const stagedReport = JSON.parse(staged.stdout) as RunReport;
        expect(stagedReport.checks.flatMap((check) => check.findings)).toContainEqual(
            containing({ file: 'space name.txt', line: 1, column: 6 }),
        );
        expect(readFileSync(join(sandbox.path, 'space name.txt'), 'utf8')).toBe('the\n');
        await Bun.write(join(sandbox.path, 'space name.txt'), `café ${TYPO.the}\n`);
        const fixed = await run(sandbox.path, [...args, '--fix'], environment);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(1);
        for (const path of paths) expect(readFileSync(join(sandbox.path, path), 'utf8')).toBe('café the\n');
        expect(readFileSync(join(sandbox.path, 'the.txt'), 'utf8')).toBe('protected\n');
        renameSync(join(sandbox.path, 'the.txt'), join(sandbox.path, 'protected.txt'));
        renameSync(join(sandbox.path, `${TYPO.the}.txt`), join(sandbox.path, 'the.txt'));
        const corrected = await run(sandbox.path, args, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'init deletes a nested spelling configuration, checks ignore rogue native files, and uninstall restores it',
    async () => {
        await using sandbox = await testdir();
        const original = `[default]\nlocale = "en-gb"\n[default.extend-words]\n${TYPO.the} = "${TYPO.the}"\n[files]\nextend-exclude = ["src/**"]\n`;
        await createFileTree(sandbox.path, {
            'sample.txt': `${TYPO.the}\n`,
            'nested/typos.toml': original,
            'nested/src/ignored.txt': `${TYPO.receive}\n`,
        });
        chmodSync(join(sandbox.path, 'nested/typos.toml'), 0o640);
        const environment = { PATH: toolsPath(['typos']) };
        const initialized = await run(sandbox.path, initArgs(['spelling']), environment);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        expect(existsSync(join(sandbox.path, 'nested/typos.toml'))).toBe(false);
        const configuration = readFileSync(join(sandbox.path, '.gspot/config/typos.toml'), 'utf8');
        await createFileTree(sandbox.path, {
            'nested/rogue/typos.toml': '[default]\ncheck-file = false\n',
            'nested/rogue/sample.txt': `${TYPO.receive}\n`,
        });
        commitAll(sandbox.path);
        const args = ['check', '--only', 'spelling/typos', '--no-cache', '--json'];
        const checked = await run(sandbox.path, args, environment);
        expect(checked.code, checked.stdout + checked.stderr).toBe(1);
        const report = JSON.parse(checked.stdout) as RunReport;
        // The deleted file's exclusions and words are gone, and the rogue native file does not turn checking off.
        expect(report.checks.flatMap((check) => check.findings)).toStrictEqual(
            containingAll([
                containing({ file: 'sample.txt' }),
                containing({ file: 'nested/src/ignored.txt' }),
                containing({ file: 'nested/rogue/sample.txt' }),
            ]),
        );
        const fixed = await run(sandbox.path, [...args, '--fix'], environment);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        for (const [path, text] of Object.entries({
            'sample.txt': 'the\n',
            'nested/src/ignored.txt': 'receive\n',
            'nested/rogue/sample.txt': 'receive\n',
        }))
            expect(readFileSync(join(sandbox.path, path), 'utf8')).toBe(text);
        const corrected = await run(sandbox.path, args, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        await expectSpellingRestoration(sandbox.path, environment, configuration, original);
    },
    PLANTED_TIMEOUT_MS,
);
