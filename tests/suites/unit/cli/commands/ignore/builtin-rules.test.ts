import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';

import type { TomlTable } from '#cli/types/settings.ts';
import { parseCheckReport, runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
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

test('gspot ignore takes a documented rule of a built-in check that reports several rules', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['naming']) });
    const ignored = await runGspot(sandbox.path, [
        'ignore',
        'naming/identifiers',
        '--rule',
        'banned-word',
        '--reason',
        'The vendored client keeps its upstream names.',
    ]);
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    const written = parse(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(written['ignore']).toStrictEqual([
        {
            check: 'naming/identifiers',
            rule: 'banned-word',
            reason: 'The vendored client keeps its upstream names.',
        },
    ]);
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
        '--json',
    ]);
    expect(refused.code).toBe(2);
    expect(JSON.parse(refused.stdout)).toMatchObject({
        error: 'arguments',
        message: expect.stringContaining('document') as string,
    });
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
