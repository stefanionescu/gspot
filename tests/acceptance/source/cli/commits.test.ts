import { pathToFileURL } from 'node:url';
import { delimiter, join } from 'node:path';
import { git } from '#tests/support/cli/git.ts';
import { chmodSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { script } from '#tests/support/cli/planted.ts';
import { pushReportSchema } from '#cli/execution/report.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/constants/support/cli.ts';
// The commits configuration: the commit-msg hook refuses a message outside the convention and passes one inside it.
import { gspot, run, runProcess } from '#tests/support/cli/command.ts';
import type { CommandFailureJson } from '#cli/types/commands/commands.ts';
import { COMMITS_INIT } from '#tests/constants/acceptance/source/cli/cli.ts';
import { installPrivateTools, toolsPath } from '#tests/support/cli/tools.ts';

describe('the commits configuration', () => {
    test(
        'the commit-msg hook refuses a free-form message and takes a conventional one',
        async () => {
            await using sandbox = await testdir();
            await using launcher = await testdir();
            await createFileTree(launcher.path, {
                gspot: `#!/usr/bin/env bun
const child = Bun.spawnSync([process.execPath, ${JSON.stringify(gspot)}, ...process.argv.slice(2)], { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' });
process.exit(child.exitCode);
`,
            });
            chmodSync(join(launcher.path, 'gspot'), 0o755);
            await createFileTree(sandbox.path, { 'scripts/a.sh': script, 'README.md': '# planted\n' });
            git(sandbox.path, ['init', '-q']);
            git(sandbox.path, ['add', '-A']);
            git(sandbox.path, ['commit', '-qm', 'init']);
            const init = await run(sandbox.path, COMMITS_INIT);
            expect(init.stdout).toContain('write');
            expect(init.code, init.stdout + init.stderr).toBe(0);
            const installed = await run(sandbox.path, ['install']);
            expect(installed.code, installed.stdout + installed.stderr).toBe(0);
            const selected = await run(sandbox.path, ['set', 'level', 'all']);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            await Bun.write(join(sandbox.path, 'notes.md'), '# notes\n');
            git(sandbox.path, ['add', '-A']);
            const environment = {
                NO_COLOR: '1',
                PATH: `${launcher.path}${delimiter}${toolsPath(['commitlint'])}`,
            };
            const bad = git(sandbox.path, ['commit', '-qm', 'Added notes.'], environment);
            expect(bad.code).not.toBe(0);
            expect(`${bad.stdout}${bad.stderr}`).toContain('type-empty');
            expect(bad.stdout + bad.stderr).toContain(`--message-file ${join(sandbox.path, '.git/COMMIT_EDITMSG')}`);
            expect(bad.stdout + bad.stderr).toContain('Bypass this hook once: git commit --no-verify');
            const good = git(sandbox.path, ['commit', '-qm', 'docs: add the notes page'], environment);
            expect(good.code, good.stdout + good.stderr).toBe(0);
            const reportPath = join(sandbox.path, '.gspot/reports/report.json');
            const report = readFileSync(reportPath, 'utf8');
            const previous = JSON.parse(report) as { stage: string };
            expect(previous.stage).toBe('commit');
            const sarifPath = join(sandbox.path, '.gspot/reports/report.sarif');
            const sarif = readFileSync(sarifPath, 'utf8');
            const draft = join(sandbox.path, 'draft.txt');
            await Bun.write(draft, 'Fixed stuff.\n');
            const refused = await run(
                sandbox.path,
                ['check', '--only', 'commits/commitlint', '--stage', 'message', '--message-file', draft],
                environment,
            );
            expect(refused.code).toBe(1);
            expect(refused.stdout).toContain('commits/commitlint');
            expect(readFileSync(reportPath, 'utf8')).toBe(report);
            expect(readFileSync(sarifPath, 'utf8')).toBe(sarif);
            const accepted = await run(sandbox.path, ['check', '--only', 'commits/range', '--no-cache'], environment);
            expect(accepted.code).toBe(0);
            await Bun.write(join(sandbox.path, 'more.md'), '# more\n');
            git(sandbox.path, ['add', '-A']);
            git(sandbox.path, ['commit', '-qm', 'Pushed past the hook.', '--no-verify']);
            const range = await run(sandbox.path, ['check', '--only', 'commits/range', '--no-cache'], environment);
            expect(range.code).toBe(1);
            expect(range.stdout).toContain('type-empty');
        },
        PLANTED_TIMEOUT_MS,
    );
});

test(
    'push checks every distinct commit message even when the pushed trees and changed paths are identical',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = ["commits"]\nlevel = "all"\n[rules]\ninstall = false\n',
        });
        expect(git(sandbox.path, ['init', '-q']).code).toBe(0);
        const applied = await run(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await installPrivateTools(sandbox.path);
        expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
        expect(git(sandbox.path, ['commit', '-qm', 'chore: initialize']).code).toBe(0);
        const base = git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim();
        const tree = git(sandbox.path, ['rev-parse', 'HEAD^{tree}']).stdout.trim();
        const good = git(sandbox.path, ['commit-tree', tree, '-p', base, '-m', 'docs: reviewed']).stdout.trim();
        const bad = git(sandbox.path, ['commit-tree', tree, '-p', base, '-m', 'Bad message.']).stdout.trim();
        const command = [process.execPath, gspot, 'check', '--push', '--only', 'commits/range', '--json'];
        const options = { cwd: sandbox.path, env: { PATH: toolsPath(['commitlint']) } };
        const rejected = await runProcess(command, {
            ...options,
            stdin: `refs/heads/good ${good} refs/heads/good ${base}\nrefs/heads/bad ${bad} refs/heads/bad ${base}\n`,
        });
        expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
        const report = pushReportSchema.parse(JSON.parse(rejected.stdout));
        expect(report.revisions).toHaveLength(1);
        expect(new Set(report.revisions[0]?.commits)).toStrictEqual(new Set([good, bad]));
        expect(
            report.revisions[0]?.report.checks[0]?.findings.some(
                (finding) => finding.rule === 'type-empty' && finding.message.includes(bad),
            ),
        ).toBe(true);
        const corrected = await runProcess(command, {
            ...options,
            stdin: `refs/heads/good ${good} refs/heads/good ${base}\n`,
        });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(pushReportSchema.parse(JSON.parse(corrected.stdout)).revisions[0]?.report.checks[0]?.status).toBe('ok');
        expect(git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim()).toBe(base);
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'a shallow push checks source content but refuses incomplete required history until it is fetched',
    async () => {
        await using sandbox = await testdir();
        const source = join(sandbox.path, 'source');
        await createFileTree(source, {
            'gspot.toml':
                'version = 1\nlevel = "all"\nconfigurations = ["bash", "commits"]\n[rules]\ninstall = false\n',
            'source.sh': 'echo base\n',
        });
        expect(git(source, ['init', '-q']).code).toBe(0);
        const applied = await run(source, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        expect(git(source, ['add', '-A']).code).toBe(0);
        expect(git(source, ['commit', '-qm', 'chore: initialize']).code).toBe(0);
        const base = git(source, ['rev-parse', 'HEAD']).stdout.trim();
        await Bun.write(join(source, 'source.sh'), 'echo selected\n');
        expect(git(source, ['commit', '-qam', 'feat: select source']).code).toBe(0);
        const selected = git(source, ['rev-parse', 'HEAD']).stdout.trim();
        expect(git(sandbox.path, ['clone', '--depth=1', pathToFileURL(source).href, 'checkout']).code).toBe(0);
        const checkout = join(sandbox.path, 'checkout');
        await installPrivateTools(checkout);
        const options = {
            cwd: checkout,
            env: { PATH: toolsPath(['commitlint']) },
            stdin: `refs/heads/main ${selected} refs/heads/main ${'0'.repeat(40)}\n`,
        };
        const command = [process.execPath, gspot, 'check', '--push', '--json', '--only'];
        const content = await runProcess([...command, 'bash/syntax'], options);
        expect(content.code, content.stdout + content.stderr).toBe(0);
        const contentReport = pushReportSchema.parse(JSON.parse(content.stdout));
        expect(contentReport.revisions[0]?.historyComplete).toBe(false);
        expect(contentReport.revisions[0]?.report.checks[0]?.status).toBe('ok');
        const refused = await runProcess([...command, 'commits/range'], options);
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect((JSON.parse(refused.stdout) as CommandFailureJson).message).toContain(
            'Pushed history is incomplete for commits/range',
        );
        expect((JSON.parse(refused.stdout) as CommandFailureJson).message).toContain('git fetch --unshallow');
        expect(git(checkout, ['fetch', '--unshallow']).code).toBe(0);
        const completed = await runProcess([...command, 'commits/range'], options);
        expect(completed.code, completed.stdout + completed.stderr).toBe(0);
        const report = pushReportSchema.parse(JSON.parse(completed.stdout));
        expect(report.revisions[0]?.historyComplete).toBe(true);
        expect(new Set(report.revisions[0]?.commits)).toStrictEqual(new Set([base, selected]));
        expect(report.revisions[0]?.report.checks[0]?.status).toBe('ok');
        expect(git(checkout, ['rev-parse', 'HEAD']).stdout.trim()).toBe(selected);
        expect(readFileSync(join(checkout, 'source.sh'), 'utf8')).toBe('echo selected\n');
    },
    PLANTED_TIMEOUT_MS,
);
