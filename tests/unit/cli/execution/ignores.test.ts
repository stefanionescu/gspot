import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { containing } from '#tests/setup/matchers.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { applyIgnores } from '#cli/execution/ignores.ts';
import { runGspot, checkReport } from '#tests/setup/run-gspot.ts';
import { QUALITY_FIX, QUALITY_COMMAND } from '#tests/config/ignore.ts';

{
    test('a path ignore keeps the check and its fixer off those paths, and a run of only ignored paths is skipped', async () => {
        await using directory = await testdir();
        const settings = settingsText([], {
            tables: `[[command_check]]\nname = "project/quality"\ncommand = ${JSON.stringify(QUALITY_COMMAND)}\nfix = ${JSON.stringify(QUALITY_FIX)}\npaths = ["inputs/**"]\nstage = "commit"\n[[ignore]]\ncheck = "project/quality"\npaths = ["inputs/skip*", "!inputs/skip-keep.txt"]\nreason = "The skipped input preserves the sample."\n`,
        });
        await createFileTree(directory.path, {
            'gspot.toml': settings,
            'inputs/regular.txt': 'defect\n',
            'inputs/skip café.txt': 'defect\n',
            'inputs/skip-keep.txt': 'defect\n',
        });
        const args = ['check', '--only', 'project/quality', '--fix', '--json'];
        const corrected = await checkReport(directory.path, args);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        const report = corrected.report;
        expect(report.checks[0]).toMatchObject({ status: 'passed', fileCount: 2, findings: [] });
        // A second correction pass reruns the fixer over the files the first pass changed.
        for (const log of ['checked.txt', 'fixed.txt']) {
            const entries = await readFile(join(directory.path, log), 'utf8');
            for (const line of entries.trim().split('\n'))
                expect(
                    (JSON.parse(line) as string[]).toSorted((left, right) => left.localeCompare(right)),
                ).toStrictEqual(['inputs/regular.txt', 'inputs/skip-keep.txt']);
        }
        expect(await readFile(join(directory.path, 'inputs/skip café.txt'), 'utf8')).toBe('defect\n');
        const checked = await readFile(join(directory.path, 'checked.txt'), 'utf8');
        const fixed = await readFile(join(directory.path, 'fixed.txt'), 'utf8');
        const skipped = await checkReport(directory.path, [...args, '--', 'inputs/skip café.txt']);
        expect(skipped.code, skipped.stdout + skipped.stderr).toBe(0);
        const skippedReport = skipped.report;
        expect(skippedReport.skips).toStrictEqual([{ check: 'project/quality', cause: 'ignore' }]);
        expect(skippedReport.checks[0]).toMatchObject({ status: 'skipped', findings: [] });
        expect(await readFile(join(directory.path, 'checked.txt'), 'utf8')).toBe(checked);
        expect(await readFile(join(directory.path, 'fixed.txt'), 'utf8')).toBe(fixed);
        const restored = await runGspot(directory.path, [
            'unignore',
            'project/quality',
            '--paths',
            'inputs/skip*',
            '!inputs/skip-keep.txt',
        ]);
        expect(restored.code, restored.stdout + restored.stderr).toBe(0);
        const accepted = await runGspot(directory.path, [...args, '--', 'inputs/skip café.txt']);
        expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
        expect(await readFile(join(directory.path, 'inputs/skip café.txt'), 'utf8')).toBe('corrected\n');
    });
}
{
    test('ignores match by check, rule and paths and count what they matched', () => {
        const findings = [
            {
                check: 'bash/shellcheck',
                file: 'scripts/a.sh',
                rule: 'SC2312',
                message: 'm',
                fixable: false,
            },
            {
                check: 'bash/shellcheck',
                file: 'src/b.sh',
                rule: 'SC2312',
                message: 'm',
                fixable: false,
            },
            {
                check: 'bash/shellcheck',
                file: 'src/b.sh',
                rule: 'SC2086',
                message: 'm',
                fixable: false,
            },
        ];
        const result = applyIgnores(findings, [
            { check: 'bash/shellcheck', rule: 'SC2312', paths: ['scripts/**'], reason: 'why' },
            { check: 'bash/shellcheck', rule: 'SC2086', reason: 'why' },
        ]);
        expect(result.kept).toStrictEqual([
            {
                check: 'bash/shellcheck',
                file: 'src/b.sh',
                rule: 'SC2312',
                message: 'm',
                fixable: false,
            },
        ]);
        expect(result.uses.map((use) => use.matched)).toStrictEqual([1, 1]);
    });
}
{
    test('a path ignore covers its own paths, not the scopes below or beside it', async () => {
        await using sandbox = await testdir();
        const settings = settingsText(['bash'], {
            tables: '[[ignore]]\ncheck = "bash/safety"\nrule = "recursive-remove"\npaths = ["root.sh"]\nreason = "The root script owns process cleanup."\n[[ignore]]\ncheck = "bash/safety"\nrule = "recursive-remove"\npaths = ["app/cleanup.sh"]\nreason = "The application script owns process cleanup."\n[[scope]]\npath = "app"\n[[scope]]\npath = "app/child"\n[[scope]]\npath = "sibling"\n',
        });
        const source = '#!/usr/bin/env bash\nrm -rf "$target"\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': settings,
            'root.sh': source,
            'app/cleanup.sh': source,
            'app/child/cleanup.sh': source,
            'sibling/cleanup.sh': source,
        });
        const command = ['check', '--only', 'bash/safety', '--json'];
        const broken = await checkReport(sandbox.path, command);
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        expect(broken.report.checks.flatMap((check) => check.findings)).toStrictEqual([
            containing({ file: 'app/child/cleanup.sh', line: 2, rule: 'recursive-remove' }),
            containing({ file: 'sibling/cleanup.sh', line: 2, rule: 'recursive-remove' }),
        ]);
        for (const path of ['app/child/cleanup.sh', 'sibling/cleanup.sh'])
            await Bun.write(`${sandbox.path}/${path}`, '#!/usr/bin/env bash\nprintf "%s\\n" "$target"\n');
        const corrected = await runGspot(sandbox.path, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(await Bun.file(`${sandbox.path}/gspot.toml`).text()).toBe(settings);
        expect(await Bun.file(`${sandbox.path}/root.sh`).text()).toBe(source);
        expect(await Bun.file(`${sandbox.path}/app/cleanup.sh`).text()).toBe(source);
    });
}
