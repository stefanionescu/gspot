import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test.each([
    {
        name: 'removed at the root',
        options: {
            tables: 'removed_configurations = { bash = "Bash is deliberately excluded from this selection." }\n',
        },
        files: {
            'entry.sh': 'echo ready\n',
            'source.py': 'print("ready")\n',
        },
        expected: [],
    },
    {
        name: 'all Bash evidence is in a scope that removed Bash',
        options: {
            scopes: [{ path: 'api' }],
            tables: 'removed_configurations = { bash = "Bash is deliberately excluded from this selection." }\n',
        },
        files: {
            'api/entry.sh': 'echo ready\n',
            'source.py': 'print("ready")\n',
        },
        expected: [],
    },
    {
        name: 'an unaffected sibling supplies Bash evidence',
        options: {
            tables: '[[scope]]\npath = "api"\nremoved_configurations = { bash = "Bash is deliberately excluded from this selection." }\n[[scope]]\npath = "worker"\n',
        },
        files: {
            'api/entry.sh': 'echo ready\n',
            'worker/entry.sh': 'echo ready\n',
            'source.py': 'print("ready")\n',
        },
        expected: ['bash'],
    },
] as const)(
    'gspot/detected-configurations skips removed configurations outside the evidence of other scopes: $name',
    async ({ options, files, expected }) => {
        const settings = buildSandboxSettings([], { rules: true, ...options });
        await using sandbox = await createGitSandbox({ ...files, 'gspot.toml': settings });
        const findings = await runSandboxCheck(sandbox.path, 'gspot/detected-configurations');
        const names = findings.map(({ message }) => /Run gspot add (\S+?)[,\s]/u.exec(message)?.[1]);
        expect(names.filter((name) => name === 'bash')).toStrictEqual([...expected]);
        expect(names).toContain('python');
        expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
    },
);

test.each([
    {
        name: 'names the scope of a project folder',
        settings: buildSandboxSettings(['markdown']),
        commands: ['gspot add fastapi --scope py', 'gspot add python --scope py'],
    },
    {
        name: 'leaves out a removed configuration',
        settings: buildSandboxSettings(['markdown'], {
            tables: '[removed_configurations]\npython = "External tooling checks Python."\nfastapi = "External tooling checks FastAPI."\n',
        }),
        commands: [],
    },
])('gspot/detected-configurations names the gspot add command and $name', async ({ settings, commands }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': settings,
        'py/pyproject.toml': '[project]\nname = "api"\nversion = "1.0.0"\ndependencies = ["fastapi"]\n',
        'py/main.py': 'PORT = 8080\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'gspot/detected-configurations');
    expect(findings.map(({ message }) => /Run (gspot add \S+(?: --scope [^\s,]+)?)/u.exec(message)?.[1])).toStrictEqual(
        [...commands],
    );
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
});
