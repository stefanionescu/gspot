import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/harness/planted.ts';

test('ignore and loosened settings accept omitted reasons by default and enforce the repository preference', async () => {
    for (const required of [false, true]) {
        await using directory = await testdir();
        const policy = `version = 1\nrequire_reasons = ${String(required)}\npresets = ["bash"]\n[rules]\ninstall = false\n`;
        await createFileTree(directory.path, { 'gspot.toml': policy, 'entry.sh': 'if then\n' });
        const ignored = await run(directory.path, ['ignore', 'bash/syntax']);
        expect(ignored.code, ignored.stdout + ignored.stderr).toBe(required ? 2 : 0);
        const loosened = await run(directory.path, ['set', 'limits.file_lines', '400']);
        expect(loosened.code, loosened.stdout + loosened.stderr).toBe(required ? 2 : 0);
        if (required) {
            expect(readFileSync(join(directory.path, 'gspot.toml'), 'utf8')).toBe(policy);
            const explained = await run(directory.path, [
                'ignore',
                'bash/syntax',
                '--reason',
                'Reviewed independently.',
            ]);
            expect(explained.code, explained.stdout + explained.stderr).toBe(0);
        }
        const checked = await run(directory.path, ['check', '--only', 'bash/syntax', '--no-cache', '--json']);
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        const report = JSON.parse(checked.stdout) as { ignores: { check: string; reason?: string; matched: number }[] };
        expect(report.ignores[0]?.check).toBe('bash/syntax');
        expect(report.ignores[0]?.matched).toBe(0);
        expect(report.ignores[0]?.reason).toBe(required ? 'Reviewed independently.' : undefined);
        expect(ignored.stdout + ignored.stderr).not.toContain('undefined');
    }
});

test('named allowances follow require_reasons and removal restores enforcement', async () => {
    for (const required of [false, true]) {
        await using directory = await testdir();
        const policy = `version = 1\nlevel = "all"\nrequire_reasons = ${String(required)}\npresets = ["bash", "naming"]\n[rules]\ninstall = false\n`;
        await createFileTree(directory.path, { 'gspot.toml': policy, 'entry.sh': 'shell_command=example\n' });
        const entry = '{"name":"shell_command"}';
        const allowed = await run(directory.path, ['set', 'naming.allowed', entry]);
        expect(allowed.code, allowed.stdout + allowed.stderr).toBe(required ? 2 : 0);
        if (required) {
            expect(readFileSync(join(directory.path, 'gspot.toml'), 'utf8')).toBe(policy);
            const explained = await run(directory.path, [
                'set',
                'naming.allowed',
                entry,
                '--reason',
                'External protocol fixes this name',
            ]);
            expect(explained.code, explained.stdout + explained.stderr).toBe(0);
        }
        const command = ['check', '--only', 'naming/identifiers', '--no-cache', '--json'];
        const checked = await run(directory.path, command);
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        const removed = await run(directory.path, ['set', 'naming.allowed', 'shell_command', '--remove']);
        expect(removed.code, removed.stdout + removed.stderr).toBe(0);
        const restored = await run(directory.path, command);
        expect(restored.code, restored.stdout + restored.stderr).toBe(1);
        const report = JSON.parse(restored.stdout) as {
            checks: { findings: { file: string; line: number; rule: string }[] }[];
        };
        expect(report.checks[0]?.findings).toEqual([
            expect.objectContaining({ file: 'entry.sh', line: 1, rule: 'banned-term' }),
        ]);
    }
});

test.each([false, true])(
    'inline suppression reasons follow require_reasons=%s without turning the census into failures',
    async (required) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'gspot.toml': `version = 1\nlevel = "all"\nrequire_reasons = ${String(required)}\npresets = ["bash"]\n[rules]\ninstall = false\n`,
            'entry.sh': '# shellcheck disable=SC2086\necho $name\n',
        });
        const command = ['check', '--only', 'integrity/suppressions', '--no-cache', '--json'];
        const missing = await run(directory.path, command);
        expect(missing.code, missing.stdout + missing.stderr).toBe(required ? 1 : 0);
        const report = JSON.parse(missing.stdout);
        expect(report.checks[0].findings).toEqual(
            required
                ? [
                      expect.objectContaining({
                          check: 'integrity/suppressions',
                          file: 'entry.sh',
                          line: 1,
                          rule: 'shellcheck-no-reason',
                      }),
                  ]
                : [],
        );
        expect(report.suppressions['shellcheck']).toBe(1);
        await Bun.write(join(directory.path, 'entry.sh'), '# shellcheck disable=SC2086 # reason: N/A\necho $name\n');
        const empty = await run(directory.path, command);
        expect(empty.code, empty.stdout + empty.stderr).toBe(required ? 1 : 0);
        await Bun.write(
            join(directory.path, 'entry.sh'),
            '# shellcheck disable=SC2086 # reason: Intentional word splitting for this command.\necho $name\n',
        );
        const explained = await run(directory.path, command);
        expect(explained.code, explained.stdout + explained.stderr).toBe(0);
        expect(JSON.parse(explained.stdout).checks[0].findings).toEqual([]);
        expect(JSON.parse(explained.stdout).suppressions['shellcheck']).toBe(1);
    },
);

test.each([
    { preset: 'sql', path: 'query.sql', form: 'sqlfluff', bare: '-- noqa: LT01', clean: 'SELECT 1;' },
    {
        preset: 'css',
        path: 'style.css',
        form: 'stylelint',
        bare: '/* stylelint-disable */',
        clean: 'body { color: red; }',
    },
    {
        preset: 'html',
        path: 'page.html',
        form: 'html-validate',
        bare: '<!-- html-validate-disable -->',
        clean: '<p>Example</p>',
    },
    {
        preset: 'markdown',
        path: 'guide.md',
        form: 'markdownlint-cli2',
        bare: '<!-- markdownlint-disable -->',
        clean: '# Example',
    },
])(
    '$preset suppression comments use their tool definition, fail without required reasons, and accept correction',
    async ({ preset, path, form, bare, clean }) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'gspot.toml': `version = 1\nlevel = "all"\nrequire_reasons = true\npresets = ["structure", "${preset}"]\n[rules]\ninstall = false\n`,
            [path]: `${bare}\n${clean}\n`,
        });
        const command = ['check', '--only', 'integrity/suppressions', '--no-cache', '--json'];
        const failed = await run(directory.path, command);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const report = JSON.parse(failed.stdout);
        expect(report.checks[0].findings).toEqual([
            expect.objectContaining({
                check: 'integrity/suppressions',
                file: path,
                line: 1,
                rule: `${form}-no-reason`,
            }),
        ]);
        expect(report.suppressions[form]).toBe(1);
        await Bun.write(join(directory.path, path), `${clean}\n`);
        const corrected = await run(directory.path, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(JSON.parse(corrected.stdout).checks[0].findings).toEqual([]);
        expect(JSON.parse(corrected.stdout).suppressions).toEqual({});
    },
);

test('shared noqa text is attributed only to the tool that reads the file', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml':
            'version = 1\nlevel = "all"\nrequire_reasons = true\npresets = ["structure", "sql", "python"]\n[rules]\ninstall = false\n',
        'query.sql': 'SELECT 1; -- noqa: LT01\n',
        'entry.py': 'answer = 1  # noqa: F841\n',
    });
    const result = await run(directory.path, ['check', '--only', 'integrity/suppressions', '--no-cache', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const report = JSON.parse(result.stdout);
    expect(report.checks[0].findings).toEqual(
        expect.arrayContaining([
            expect.objectContaining({ file: 'query.sql', rule: 'sqlfluff-no-reason' }),
            expect.objectContaining({ file: 'entry.py', rule: 'ruff-no-reason' }),
        ]),
    );
    expect(report.checks[0].findings).toHaveLength(2);
    expect(report.suppressions).toEqual({ sqlfluff: 1, ruff: 1 });
});

test.each([false, true])(
    'placeholder reasons and omitted tool-extra reasons follow require_reasons=%s',
    async (required) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'gspot.toml': `version = 1\nrequire_reasons = ${String(required)}\npresets = ["bash"]\n[rules]\ninstall = false\n`,
            'entry.sh': 'echo example\n',
        });
        const ignored = await run(directory.path, ['ignore', 'bash/syntax', '--reason', 'TBD']);
        expect(ignored.code, ignored.stdout + ignored.stderr).toBe(required ? 2 : 0);
        const loosened = await run(directory.path, ['set', 'limits.file_lines', '400', '--reason', 'TBD']);
        expect(loosened.code, loosened.stdout + loosened.stderr).toBe(required ? 2 : 0);
        const policyPath = join(directory.path, 'gspot.toml');
        const written = readFileSync(policyPath, 'utf8');
        await Bun.write(policyPath, written + '\n[tools.shellcheck.extra]\nexternal_sources = true\n');
        const checked = await run(directory.path, ['check', '--only', 'bash/syntax', '--json']);
        expect(checked.code, checked.stdout + checked.stderr).toBe(required ? 2 : 0);
        expect(readFileSync(policyPath, 'utf8')).toBe(
            written + '\n[tools.shellcheck.extra]\nexternal_sources = true\n',
        );
    },
);
