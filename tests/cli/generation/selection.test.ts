import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
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
    writeFileSync(join(sandbox.path, 'gspot.toml'), buildPolicy(['bash', 'security']));
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
            tables: '[licenses]\nallowed = ["MPL-2.0"]\n[[scope]]\npath = "app"\n[[scope.licenses.exceptions]]\npackage = "example@1.2.3"\nlicense = "BSD"\nreason = "Reviewed installed metadata."\n[[scope]]\npath = "app/child"\n[[scope]]\npath = "sibling"\n',
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
        expect(parsed.get(path)!.exceptions).toStrictEqual([
            { package: 'example@1.2.3', license: 'BSD', reason: 'Reviewed installed metadata.' },
        ]);
    for (const path of ['.gspot/config/licenses.json', '.gspot/config/sibling/licenses.json'])
        expect(parsed.get(path)!.exceptions).toStrictEqual([]);
});
