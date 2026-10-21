import { join } from 'node:path';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { matchFields } from '#tests/setup/matchers.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { runGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { QUALITY_FIX, QUALITY_COMMAND } from '#tests/data/runs/command-checks.ts';

describe('ignores', () => {
    test('a path ignore keeps the check and its fixer off those paths, and a run of only ignored paths is skipped', async () => {
        await using folder = await testdir();
        const settings = buildSandboxSettings([], {
            tables: `[[command_check]]\nname = "project/quality"\ncommand = ${JSON.stringify(QUALITY_COMMAND)}\nfix = ${JSON.stringify(QUALITY_FIX)}\npaths = ["inputs/**"]\nstage = "commit"\n[[ignore]]\ncheck = "project/quality"\npaths = ["inputs/skip*", "!inputs/skip-keep.txt"]\nreason = "The skipped input preserves the sample."\n`,
        });
        await createFileTree(folder.path, {
            'gspot.toml': settings,
            'inputs/regular.txt': 'defect\n',
            'inputs/skip café.txt': 'defect\n',
            'inputs/skip-keep.txt': 'defect\n',
        });
        const commandArguments = ['check', '--only', 'project/quality', '--fix', '--json'];
        const corrected = parseCheckReport(await runGspot(folder.path, commandArguments));
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        const report = corrected.report;
        expect(report.checks[0]).toMatchObject({ status: 'passed', fileCount: 2, findings: [] });
        // A second correction pass reruns the fixer over the files the first pass changed.
        for (const log of ['checked.txt', 'fixed.txt']) {
            const entries = await readFile(join(folder.path, log), 'utf8');
            for (const line of entries.trim().split('\n'))
                expect(
                    (JSON.parse(line) as string[]).toSorted((left, right) => left.localeCompare(right)),
                ).toStrictEqual(['inputs/regular.txt', 'inputs/skip-keep.txt']);
        }
        expect(await readFile(join(folder.path, 'inputs/skip café.txt'), 'utf8')).toBe('defect\n');
        const checked = await readFile(join(folder.path, 'checked.txt'), 'utf8');
        const fixed = await readFile(join(folder.path, 'fixed.txt'), 'utf8');
        const skipped = parseCheckReport(
            await runGspot(folder.path, [...commandArguments, '--', 'inputs/skip café.txt']),
        );
        expect(skipped.code, skipped.stdout + skipped.stderr).toBe(0);
        const skippedReport = skipped.report;
        expect(skippedReport.checks[0]).toMatchObject({ status: 'skipped', cause: 'ignore', findings: [] });
        expect(await readFile(join(folder.path, 'checked.txt'), 'utf8')).toBe(checked);
        expect(await readFile(join(folder.path, 'fixed.txt'), 'utf8')).toBe(fixed);
        const restored = await runGspot(folder.path, [
            'unignore',
            'project/quality',
            '--paths',
            'inputs/skip*',
            '!inputs/skip-keep.txt',
        ]);
        expect(restored.code, restored.stdout + restored.stderr).toBe(0);
        const accepted = await runGspot(folder.path, [...commandArguments, '--', 'inputs/skip café.txt']);
        expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
        expect(await readFile(join(folder.path, 'inputs/skip café.txt'), 'utf8')).toBe('corrected\n');
    });
});

describe('ignores', () => {
    test('a path ignore covers its own paths, not the scopes below or beside it', async () => {
        await using sandbox = await testdir();
        const settings = buildSandboxSettings(['bash'], {
            tables: '[[ignore]]\ncheck = "bash/safety"\nrule = "recursive-remove"\npaths = ["root.sh"]\nreason = "The root script owns process cleanup."\n[[ignore]]\ncheck = "bash/safety"\nrule = "recursive-remove"\npaths = ["app/cleanup.sh"]\nreason = "The application script owns process cleanup."\n',
            scopes: [{ path: 'app' }, { path: 'app/child' }, { path: 'sibling' }],
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
        const broken = parseCheckReport(await runGspot(sandbox.path, command));
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        expect(broken.report.checks.flatMap((check) => check.findings)).toStrictEqual([
            matchFields({ file: 'app/child/cleanup.sh', line: 2, rule: 'recursive-remove' }),
            matchFields({ file: 'sibling/cleanup.sh', line: 2, rule: 'recursive-remove' }),
        ]);
        for (const path of ['app/child/cleanup.sh', 'sibling/cleanup.sh'])
            await writeFile(`${sandbox.path}/${path}`, '#!/usr/bin/env bash\nprintf "%s\\n" "$target"\n');
        const corrected = await runGspot(sandbox.path, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    });
});
