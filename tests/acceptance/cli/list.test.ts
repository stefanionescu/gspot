import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import type { CoverageReport } from '#cli/types/reports.ts';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

test('doctor and list name unsupported endings and retain different coverage within one ending', async () => {
    await using directory = await testdir();
    const policy = 'version = 1\nlevel = "all"\nconfigurations = ["bash"]\n';
    await createFileTree(directory.path, {
        'gspot.toml': `${policy}\n[[ignore]]\ncheck = "bash/syntax"\npaths = ["excluded.sh"]\nreason = "The fixture exercises differing coverage within one ending."\n`,
        'entry.sh': 'echo example\n',
        'excluded.sh': 'echo separate\n',
        'example.kt': 'fun main() { println("example") }\n',
    });
    const listed = await run(directory.path, ['list', '--json']);
    expect(listed.code, listed.stderr).toBe(0);
    const coverage = (JSON.parse(listed.stdout) as { coverage: CoverageReport }).coverage;
    const doctor = await run(directory.path, ['doctor', '--json']);
    expect(JSON.parse(doctor.stdout).coverage).toStrictEqual(coverage);
    const shells = coverage.endings.filter((entry: { ending: string }) => entry.ending === '.sh');
    expect(shells).toHaveLength(2);
    expect(shells.filter((entry: { kinds: string[] }) => entry.kinds.includes('syntax'))).toHaveLength(1);
    expect(coverage.endings).toContainEqual({ ending: '.kt', scope: '', files: 1, kinds: [] });
    const text = await run(directory.path, ['list']);
    expect(text.stdout).toContain('.kt  [scope root]  1 file  no format, syntax, style, or types check');
    const doctorText = await run(directory.path, ['doctor']);
    expect(doctorText.stdout).toContain('.kt  [scope root]  1 file  no format, syntax, style, or types check');
    writeFileSync(join(directory.path, 'gspot.toml'), policy);
    const corrected = await run(directory.path, ['list', '--json']);
    expect(
        JSON.parse(corrected.stdout).coverage.endings.filter((entry: { ending: string }) => entry.ending === '.sh'),
    ).toStrictEqual([{ ending: '.sh', scope: '', files: 2, kinds: expect.arrayContaining(['syntax']) }]);
});

test('list shows selected policy states, detected configurations, and setting values without writing', async () => {
    await using directory = await testdir();
    const policy =
        'version = 1\nconfigurations = ["bash", "nextjs"]\n[[ignore]]\ncheck = "bash/syntax"\nreason = "Review this separately."\n';
    await createFileTree(directory.path, {
        'gspot.toml': policy,
        'entry.sh': 'echo example\n',
        'query.sql': 'SELECT 1;\n',
    });
    const listed = await run(directory.path, ['list', '--json']);
    expect(listed.code, listed.stdout + listed.stderr).toBe(0);
    const result = JSON.parse(listed.stdout) as {
        installed: { name: string; checks: { name: string; scope: string; state: string }[] }[];
        detected: { name: string; command: string }[];
        available: { name: string }[];
    };
    const checks = result.installed.flatMap((configuration) => configuration.checks);
    expect(checks).toContainEqual({ name: 'bash/shellcheck', scope: '', state: 'on' });
    expect(checks).toContainEqual({ name: 'bash/syntax', scope: '', state: 'off (ignore)' });
    expect(checks).toContainEqual({ name: 'bash/shfmt', scope: '', state: 'off (level)' });
    expect(checks).toContainEqual({ name: 'nextjs/build', scope: '', state: 'waits for tools.next.build_in_gate' });
    expect(result.detected.find((configuration) => configuration.name === 'sql')?.command).toBe('gspot add sql');
    expect(result.available.some((configuration) => configuration.name === 'python')).toBe(true);
    const settings = await run(directory.path, ['list', 'settings', '--json']);
    expect(settings.code, settings.stdout + settings.stderr).toBe(0);
    const rows = (JSON.parse(settings.stdout) as { settings: { key: string; value: unknown }[] }).settings;
    expect(rows.find((row) => row.key === 'level')?.value).toBe('recommended');
    const invalid = await run(directory.path, ['list', 'unknown']);
    expect(invalid.code).toBe(2);
    const obsolete = await run(directory.path, ['doctor', '--settings']);
    expect(obsolete.code).toBe(2);
    expect(readFileSync(join(directory.path, 'gspot.toml'), 'utf8')).toBe(policy);
    expect(existsSync(join(directory.path, '.gspot'))).toBe(false);
});
