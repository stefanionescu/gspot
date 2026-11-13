import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

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
        const names = await listDetectedNames(sandbox.path);
        expect(names.filter((name) => name === 'bash')).toStrictEqual([...expected]);
        expect(names).toContain('python');
    },
);

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
