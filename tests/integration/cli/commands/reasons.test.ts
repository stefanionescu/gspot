import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/harness/cli/command.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import type { Finding, RunReport } from '#cli/types/execution/execution.ts';
import { containing, containingAll, textContaining } from '#tests/harness/expectations.ts';

test.each([false, true])(
    'ignore and loosened settings accept omitted reasons by default and enforce require_reasons=%s',
    async (required) => {
        await using directory = await testdir();
        const policy = `require_reasons = ${String(required)}\nkits = ["bash"]\n[guides]\ninstall = false\n`;
        await createFileTree(directory.path, { 'gspot.toml': policy, 'entry.sh': 'if then\n' });
        const ignored = await runGspot(directory.path, ['ignore', 'bash/syntax']);
        expect(ignored.code, ignored.stdout + ignored.stderr).toBe(required ? 2 : 0);
        const loosened = await runGspot(directory.path, ['set', 'limits.file_lines', '400']);
        expect(loosened.code, loosened.stdout + loosened.stderr).toBe(required ? 2 : 0);
        // A refused write leaves the policy as it was; the ignore then needs its reason.
        expect(readFileSync(join(directory.path, 'gspot.toml'), 'utf8') === policy).toBe(required);
        const explained = required
            ? await runGspot(directory.path, ['ignore', 'bash/syntax', '--reason', 'Reviewed independently.'])
            : ignored;
        expect(explained.code, explained.stdout + explained.stderr).toBe(0);
        const checked = await runGspot(directory.path, ['check', '--only', 'bash/syntax', '--json']);
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        const report = JSON.parse(checked.stdout) as { ignores: { check: string; reason?: string; matched: number }[] };
        expect(report.ignores[0]?.check).toBe('bash/syntax');
        expect(report.ignores[0]?.matched).toBe(0);
        expect(report.ignores[0]?.reason).toBe(required ? 'Reviewed independently.' : undefined);
        expect(ignored.stdout + ignored.stderr).not.toContain('undefined');
    },
);

test.each([false, true])(
    'named allowances follow require_reasons=%s and removal restores enforcement',
    async (required) => {
        {
            await using directory = await testdir();
            const policy = `level = "all"\nrequire_reasons = ${String(required)}\nkits = ["bash", "naming"]\n[guides]\ninstall = false\n`;
            await createFileTree(directory.path, { 'gspot.toml': policy, 'entry.sh': 'helper_command=example\n' });
            const entry = '{"name":"helper_command"}';
            const allowed = await runGspot(directory.path, ['set', 'naming.allowed', entry]);
            expect(allowed.code, allowed.stdout + allowed.stderr).toBe(required ? 2 : 0);
            expect(readFileSync(join(directory.path, 'gspot.toml'), 'utf8') === policy).toBe(required);
            const explained = required
                ? await runGspot(directory.path, [
                      'set',
                      'naming.allowed',
                      entry,
                      '--reason',
                      'External protocol fixes this name',
                  ])
                : allowed;
            expect(explained.code, explained.stdout + explained.stderr).toBe(0);
            const command = ['check', '--only', 'naming/identifiers', '--json'];
            const checked = await runGspot(directory.path, command);
            expect(checked.code, checked.stdout + checked.stderr).toBe(0);
            const removed = await runGspot(directory.path, ['set', 'naming.allowed', 'helper_command', '--remove']);
            expect(removed.code, removed.stdout + removed.stderr).toBe(0);
            const restored = await runGspot(directory.path, command);
            expect(restored.code, restored.stdout + restored.stderr).toBe(1);
            const report = JSON.parse(restored.stdout) as {
                checks: { findings: { file: string; line: number; rule: string }[] }[];
            };
            expect(report.checks[0]?.findings).toStrictEqual([
                containing({ file: 'entry.sh', line: 1, rule: 'banned-term' }),
            ]);
        }
    },
    PLANTED_TIMEOUT_MS,
);

test.each([false, true])('inline suppression reasons follow require_reasons=%s', async (required) => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': `level = "all"\nrequire_reasons = ${String(required)}\nkits = ["bash"]\n[guides]\ninstall = false\n`,
        'entry.sh': '# shellcheck disable=SC2086\necho $name\n',
    });
    const command = ['check', '--only', 'integrity/suppressions', '--json'];
    const missing = await runGspot(directory.path, command);
    expect(missing.code, missing.stdout + missing.stderr).toBe(required ? 1 : 0);
    const report = JSON.parse(missing.stdout) as RunReport;
    const unexplained: Finding = containing({
        check: 'integrity/suppressions',
        file: 'entry.sh',
        line: 1,
        rule: 'shellcheck-no-reason',
    });
    expect(report.checks[0]!.findings).toStrictEqual(required ? [unexplained] : []);
    await Bun.write(join(directory.path, 'entry.sh'), '# shellcheck disable=SC2086 # reason: N/A\necho $name\n');
    const empty = await runGspot(directory.path, command);
    expect(empty.code, empty.stdout + empty.stderr).toBe(required ? 1 : 0);
    await Bun.write(
        join(directory.path, 'entry.sh'),
        '# shellcheck disable=SC2086 # reason: Intentional word splitting for this command.\necho $name\n',
    );
    const explained = await runGspot(directory.path, command);
    expect(explained.code, explained.stdout + explained.stderr).toBe(0);
    expect((JSON.parse(explained.stdout) as RunReport).checks[0]!.findings).toStrictEqual([]);
});

test.each([
    { configuration: 'sql', path: 'query.sql', form: 'sqlfluff', bare: '-- noqa: LT01', clean: 'SELECT 1;' },
    {
        configuration: 'css',
        path: 'style.css',
        form: 'stylelint',
        bare: '/* stylelint-disable */',
        clean: 'body { color: red; }',
    },
    {
        configuration: 'html',
        path: 'page.html',
        form: 'html-validate',
        bare: '<!-- html-validate-disable -->',
        clean: '<p>Example</p>',
    },
    {
        configuration: 'markdown',
        path: 'guide.md',
        form: 'markdownlint-cli2',
        bare: '<!-- markdownlint-disable -->',
        clean: '# Example',
    },
])(
    '$configuration suppression comments use their tool definition, fail without required reasons, and accept correction',
    async ({ configuration, path, form, bare, clean }) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'gspot.toml': `level = "all"\nrequire_reasons = true\nkits = ["structure", "${configuration}"]\n[guides]\ninstall = false\n`,
            [path]: `${bare}\n${clean}\n`,
        });
        const command = ['check', '--only', 'integrity/suppressions', '--json'];
        const failed = await runGspot(directory.path, command);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const report = JSON.parse(failed.stdout) as RunReport;
        expect(report.checks[0]!.findings).toStrictEqual([
            containing({
                check: 'integrity/suppressions',
                file: path,
                line: 1,
                rule: `${form}-no-reason`,
            }),
        ]);
        await Bun.write(join(directory.path, path), `${clean}\n`);
        const corrected = await runGspot(directory.path, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks[0]!.findings).toStrictEqual([]);
    },
);

test('shared noqa text is attributed only to the tool that reads the file', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml':
            'level = "all"\nrequire_reasons = true\nkits = ["structure", "sql", "python"]\n[guides]\ninstall = false\n',
        'query.sql': 'SELECT 1; -- noqa: LT01\n',
        'entry.py': 'answer = 1  # noqa: F841\n',
    });
    const result = await runGspot(directory.path, ['check', '--only', 'integrity/suppressions', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const report = JSON.parse(result.stdout) as RunReport;
    expect(report.checks[0]!.findings).toStrictEqual(
        containingAll([
            containing({ file: 'query.sql', rule: 'sqlfluff-no-reason' }),
            containing({ file: 'entry.py', rule: 'ruff-no-reason' }),
        ]),
    );
    expect(report.checks[0]!.findings).toHaveLength(2);
});

test.each([false, true])(
    'placeholder reasons and omitted tool-extra reasons follow require_reasons=%s',
    async (required) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'gspot.toml': `require_reasons = ${String(required)}\nkits = ["bash"]\n[guides]\ninstall = false\n`,
            'entry.sh': 'echo example\n',
        });
        const ignored = await runGspot(directory.path, ['ignore', 'bash/syntax', '--reason', 'TBD']);
        expect(ignored.code, ignored.stdout + ignored.stderr).toBe(required ? 2 : 0);
        const loosened = await runGspot(directory.path, ['set', 'limits.file_lines', '400', '--reason', 'TBD']);
        expect(loosened.code, loosened.stdout + loosened.stderr).toBe(required ? 2 : 0);
        const policyPath = join(directory.path, 'gspot.toml');
        const written = readFileSync(policyPath, 'utf8');
        await Bun.write(policyPath, written + '\n[tools.shellcheck.extra]\nexternal_sources = true\n');
        const checked = await runGspot(directory.path, ['check', '--only', 'bash/syntax', '--json']);
        expect(checked.code, checked.stdout + checked.stderr).toBe(required ? 1 : 0);
        const findings = (
            JSON.parse(checked.stdout) as { checks: { check: string; findings: { file: string }[] }[] }
        ).checks
            .filter((check) => check.check === 'integrity/policy')
            .flatMap((check) => check.findings);
        const aboutExtra = { file: 'gspot.toml', message: textContaining('extra') };
        expect(findings).toMatchObject(required ? [aboutExtra] : []);
        expect(readFileSync(policyPath, 'utf8')).toBe(
            written + '\n[tools.shellcheck.extra]\nexternal_sources = true\n',
        );
    },
);

test.each([
    { key: 'naming.banned_terms', flag: '', item: 'added', expected: ['original', 'added'], code: 0 },
    { key: 'naming.banned_terms', flag: '--remove', item: 'original', expected: [], code: 2 },
    { key: 'naming.banned_terms', flag: '--replace', item: 'added', expected: ['added'], code: 2 },
    { key: 'tools.bash.architecture_roots', flag: '', item: 'added', expected: ['original', 'added'], code: 0 },
    { key: 'tools.bash.architecture_roots', flag: '--remove', item: 'original', expected: [], code: 0 },
    { key: 'tools.bash.architecture_roots', flag: '--replace', item: 'added', expected: ['added'], code: 0 },
])('list edits preserve reason requirements for $key $flag', async ({ key, flag, item, expected, code }) => {
    await using directory = await testdir();
    const policy = [
        'require_reasons = true',
        'kits = ["bash", "naming"]',
        '[guides]',
        'install = false',
        '[naming]',
        'banned_terms = ["original"]',
        '[tools.bash]',
        'architecture_roots = ["original"]',
    ].join('\n');
    await createFileTree(directory.path, { 'gspot.toml': policy, 'entry.sh': 'echo example\n' });
    const args = ['set', key, item, ...[flag].filter((value) => value !== '')];
    const result = await runGspot(directory.path, args);
    expect(result.code, result.stdout + result.stderr).toBe(code);
    expect(readFileSync(join(directory.path, 'gspot.toml'), 'utf8') === policy).toBe(code === 2);
    const explained =
        code === 2 ? await runGspot(directory.path, [...args, '--reason', 'Repository requirements changed.']) : result;
    expect(explained.code, explained.stdout + explained.stderr).toBe(0);
    const parsed = Bun.TOML.parse(readFileSync(join(directory.path, 'gspot.toml'), 'utf8'));
    let written: unknown = parsed;
    for (const part of key.split('.')) {
        expect(written).toBeObject();
        written = (written as Record<string, unknown>)[part];
    }
    expect(written).toStrictEqual(expected);
});
