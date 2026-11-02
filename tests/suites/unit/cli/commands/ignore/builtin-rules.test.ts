import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('gspot ignore takes a Ruff rule prefix, which Ruff has no page for', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python']),
        'main.py': 'VALUE = 1\n',
    });
    const ignored = await runGspot(sandbox.path, ['ignore', 'python/ruff', '--rule', 'D', '--reason', 'Legacy docs.']);
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toContain('rule = "D"');
});

test('a documented YAML exception suppresses only its rule and path, and typos leave settings unchanged', async () => {
    const settings = buildSandboxSettings(['data-files']);
    await using sandbox = await createGitSandbox({
        'gspot.toml': settings,
        'stream.yml': 'first: yes\n---\nsecond: true\n',
        'other.yml': 'first: true\n---\nsecond: false\n',
    });
    const refused = await runGspot(sandbox.path, [
        'ignore',
        'data-files/yaml',
        '--rule',
        'document',
        '--reason',
        'The consumer requires a stream.',
    ]);
    expect(refused.code).toBe(2);
    expect(refused.stderr).toBe('gspot does not know rule document of data-files/yaml.\n');
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
    const ignored = await runGspot(sandbox.path, [
        'ignore',
        'data-files/yaml',
        '--rule',
        'documents',
        '--paths',
        'stream.yml',
        '--reason',
        'The consumer requires a stream.',
    ]);
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    const checked = parseCheckReport(await runGspot(sandbox.path, ['check', '--only', 'data-files/yaml', '--json']));
    expect(checked.code, checked.stderr).toBe(1);
    const findings = checked.report.checks.flatMap(({ findings }) =>
        findings.map(({ file, rule }) => ({ file, rule })),
    );
    expect(findings).toContainEqual({ file: 'stream.yml', rule: 'truthy' });
    expect(findings).toContainEqual({ file: 'other.yml', rule: 'documents' });
    expect(findings).not.toContainEqual({ file: 'stream.yml', rule: 'documents' });
});
