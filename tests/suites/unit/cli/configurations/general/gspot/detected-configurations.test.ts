import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

async function listDetectedNames(root: string): Promise<Array<string | undefined>> {
    const findings = await runSandboxCheck(root, 'gspot/detected-configurations');
    return findings.map(({ message }) => /Run gspot add (\S+?)[,\s]/u.exec(message)?.[1]);
}

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
});

test('gspot/detected-configurations reads no evidence in the paths of an ignore that names no rule', async () => {
    const files = {
        'services/package.json': '{"private":true,"dependencies":{"zod":"4.1.5"}}',
        'services/source.ts': 'export const value = 1;\n',
        'tools/entry.sh': 'echo ready\n',
    };
    const ignore = '[[ignore]]\npaths = ["services/**"]\nreason = "Another tool checks the services."\n';
    await using sandbox = await createGitSandbox({ ...files, 'gspot.toml': buildSandboxSettings(['markdown']) });
    expect(await listDetectedNames(sandbox.path)).toStrictEqual(['bash', 'javascript', 'typescript', 'zod']);
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings(['markdown'], { tables: ignore }));
    expect(await listDetectedNames(sandbox.path)).toStrictEqual(['bash']);
});

test('gspot/detected-configurations gives each configuration the evidence of the scope that the command names', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['markdown']),
        'package.json': '{"private":true,"devDependencies":{"left-pad":"1.3.0"}}',
        'services/package.json': '{"private":true,"dependencies":{"vitest":"4.1.11"}}',
        'services/source.ts': 'export const value = 1;\n',
        'services/page-script.js': 'export const page = 1;\n',
        'supabase/package.json': '{"private":true}',
        'supabase/types.ts': 'export const table = 1;\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'gspot/detected-configurations');
    expect(findings.map(({ message }) => message.replace(/, or gspot remove.*$/u, ''))).toStrictEqual([
        'No check reads javascript (package.json). Run gspot add javascript',
        'No check reads typescript (1 .ts file). Run gspot add typescript --scope services',
        'No check reads vitest (vitest in services/package.json). Run gspot add vitest --scope services',
        'No check reads typescript (1 .ts file). Run gspot add typescript --scope supabase',
    ]);
});

test('gspot/detected-configurations says that a configuration with no check changes lint rules', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript']),
        'package.json': '{"private":true,"dependencies":{"zustand":"5.0.0"}}',
        'store.ts': 'export const value = 1;\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'gspot/detected-configurations');
    expect(findings.map(({ message }) => message)).toContainEqual(
        expect.stringContaining('zustand changes the lint rules for this code') as string,
    );
});

test('detection leaves the tool projects in .gspot out, and reads your pyproject.toml', async () => {
    await using sandbox = await createGitSandbox({});
    const python = '[project]\nname = "example"\nversion = "1.0.0"\ndependencies = ["pytest==8.4.2"]\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([]),
        [GSPOT_PATHS.pythonProject]: python,
        [GSPOT_PATHS.npmProject]: '{"dependencies":{"react":"19.1.1"}}',
    });
    expect(await listDetectedNames(sandbox.path)).toStrictEqual([]);
    await writeFile(join(sandbox.path, 'pyproject.toml'), python);
    expect(await listDetectedNames(sandbox.path)).toStrictEqual(['pytest', 'python']);
});

test('detection names each test framework that the package installs', async () => {
    const dependencies = { '@nestjs/core': '11.2.3', jest: '30.2.0' };
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['nestjs']),
        'package.json': JSON.stringify({ name: 'service', private: true, dependencies }),
        'src/server.ts': 'export const port = 3000;\n',
    });
    expect(await listDetectedNames(sandbox.path)).toStrictEqual(['jest']);
    await writeFile(
        join(sandbox.path, 'package.json'),
        JSON.stringify({ name: 'service', private: true, dependencies: { ...dependencies, vitest: '4.1.11' } }),
    );
    expect(await listDetectedNames(sandbox.path)).toStrictEqual(['jest', 'vitest']);
});
