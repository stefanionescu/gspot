import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import type { LicenseAllowlist } from '#cli/types/checks/general/licenses.ts';

test('manual language choices include security output without selecting security separately', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash']),
        'sample.sh': 'echo sample\n',
    });
    const target = '.gspot/config/semgrep/bash.yml';
    const plainSession = await openSession(sandbox.path);
    const plainOutput = emitAll(plainSession);
    expect(plainOutput.files.find((file) => file.path === target)?.content).toContain('rules:');
    await writeFile(join(sandbox.path, 'gspot.toml'), buildPolicy(['bash', 'security']));
    const securitySession = await openSession(sandbox.path);
    const securityOutput = emitAll(securitySession);
    const generated = securityOutput.files.find((file) => file.path === target);
    expect(generated?.content).toBe(plainOutput.files.find((file) => file.path === target)?.content);
});

test('license configuration retains scoped exceptions and inherited license allowances', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{"private":true}',
        'app/pyproject.toml': '[project]\nname = "app"\nversion = "1.0.0"\n',
        'app/child/pyproject.toml': '[project]\nname = "child"\nversion = "1.0.0"\n',
        'sibling/pyproject.toml': '[project]\nname = "sibling"\nversion = "1.0.0"\n',
        'app/child/source.py': 'selected = True\n',
        'sibling/source.py': 'selected = True\n',
        'gspot.toml': buildPolicy(['licenses'], {
            tables: '[licenses]\nallowed = ["MPL-2.0"]\n[scope."app"]\n[scope."app".licenses.exceptions."example@1.2.3"]\nlicense = "BSD"\nreason = "Reviewed installed metadata."\n[scope."app/child"]\n[scope."sibling"]\n',
        }),
    });
    const session = await openSession(sandbox.path);
    const configs = emitAll(session).files.filter(({ path }) => path.endsWith('/licenses.json'));
    const parsed = new Map(configs.map(({ path, content }) => [path, JSON.parse(content) as LicenseAllowlist]));
    expect(parsed.size).toBe(4);
    for (const path of [
        '.gspot/config/licenses.json',
        '.gspot/config/app/licenses.json',
        '.gspot/config/app/child/licenses.json',
        '.gspot/config/sibling/licenses.json',
    ])
        expect(parsed.get(path)!.allowed).toContain('MPL-2.0');
    for (const path of ['.gspot/config/app/licenses.json', '.gspot/config/app/child/licenses.json'])
        expect(parsed.get(path)!.exceptions).toStrictEqual({
            'example@1.2.3': { license: 'BSD', reason: 'Reviewed installed metadata.' },
        });
    for (const path of ['.gspot/config/licenses.json', '.gspot/config/sibling/licenses.json'])
        expect(parsed.get(path)!.exceptions).toStrictEqual({});
});

test.each([{ configurations: ['licenses'] }, { configurations: [] }])(
    'exceptions alone activate descendant license tools without a root manifest: $configurations',
    async ({ configurations }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildPolicy([...configurations], {
                tables: '[licenses.exceptions."example@1.0.0"]\nlicense = "MIT"\nreason = "Reviewed installed metadata."\n[scope."docs"]\nconfigurations = ["licenses"]\n',
            }),
            'docs/package.json': '{"name":"docs","private":true}',
        });
        const generated = emitAll(await openSession(sandbox.path));
        expect(generated.files.some(({ path }) => path === '.gspot/config/licenses.json')).toBe(true);
        expect(generated.files.find(({ path }) => path === '.gspot/config/docs/licenses.json')?.content).toContain(
            'example@1.0.0',
        );
        expect(generated.files.find(({ path }) => path === '.gspot/package.json')?.content).toContain(
            'license-checker-rseidelsohn',
        );
        expect(generated.files.find(({ path }) => path === '.gspot/pyproject.toml')).toBeUndefined();
    },
);
