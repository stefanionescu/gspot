import type { RunReport } from '#cli/execution/report.ts';

import { withLifecycleOwner } from '#cli/lifecycle/ownership.ts';

import { installPythonProject, resolvePythonProject } from '#cli/tools/python-project.ts';
import { expect, test } from 'bun:test';
import { join } from 'node:path';

import { emitAll } from '#cli/generation/render.ts';

import { openSession } from '#cli/execution/session.ts';
import { run } from '#tests/support/cli/command.ts';
import { createFileTree, testdir } from 'testdirs';

test('framework security packs stay within inherited scopes and preserve sibling input', async () => {
    await using sandbox = await testdir();
    const policy =
        'version = 1\nconfigurations = ["javascript", "security"]\n[rules]\ninstall = false\n[[scope]]\npath = "app"\nconfigurations = ["express"]\n[scope.tools.semgrep]\nignore = [{ paths = ["app/**/ignored.js"], reason = "Generated fixtures are checked by their producer." }]\n[[scope]]\npath = "app/child"\n[[scope]]\npath = "sibling"\n';
    const source = 'res.send(req.body);\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        'source.js': source,
        'app/source.js': source,
        'app/child/source.js': source,
        'sibling/source.js': source,
        'app/ignored.js': 'eval(input);\n',
        'app/child/ignored.js': 'eval(input);\n',
        'sibling/ignored.js': 'eval(input);\n',
    });
    const renderSession6 = await openSession(sandbox.path);
    const outputs = emitAll(renderSession6.policyFiles.policy, renderSession6.repository, renderSession6.scopes, {
        version: renderSession6.version,
        packageManager: renderSession6.packageManager,
    }).files.filter(
        ({ path }) => path.includes('/semgrep/') || path.endsWith('.semgrepignore') || path === '.gspot/pyproject.toml',
    );
    await withLifecycleOwner(sandbox.path, async (owner) => {
        await resolvePythonProject(sandbox.path, outputs, owner);
    });
    for (const output of outputs) await Bun.write(join(sandbox.path, output.path), output.content);
    await installPythonProject(sandbox.path);
    const command = ['check', '--only', 'security/semgrep', '--no-cache', '--json'];
    const broken = await run(sandbox.path, command);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect(
        (JSON.parse(broken.stdout) as RunReport).checks.flatMap(({ scope, findings }) =>
            findings.map((finding) => ({ scope, finding })),
        ),
    ).toStrictEqual([
        {
            scope: 'app',
            finding: expect.objectContaining({ file: 'app/source.js', line: 1, rule: 'express-res-send-raw-input' }),
        },
        {
            scope: 'app/child',
            finding: expect.objectContaining({
                file: 'app/child/source.js',
                line: 1,
                rule: 'express-res-send-raw-input',
            }),
        },
        {
            scope: 'sibling',
            finding: expect.objectContaining({ file: 'sibling/ignored.js', line: 1, rule: 'node-no-eval' }),
        },
    ]);
    for (const path of ['app/source.js', 'app/child/source.js'])
        await Bun.write(join(sandbox.path, path), 'res.json({ message: "Accepted" });\n');
    await Bun.write(join(sandbox.path, 'sibling/ignored.js'), 'JSON.parse(input);\n');
    const corrected = await run(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(await Bun.file(join(sandbox.path, 'source.js')).text()).toBe(source);
    expect(await Bun.file(join(sandbox.path, 'sibling/source.js')).text()).toBe(source);
    expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
    const invalidRule = join(sandbox.path, '.gspot/config/app/semgrep/broken.yml');
    await Bun.write(invalidRule, 'rules: [');
    const invalid = await run(sandbox.path, command);
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(2);
    expect((JSON.parse(invalid.stdout) as RunReport).checks.find((check) => check.scope === 'app')?.status).toBe(
        'error',
    );
    expect(await Bun.file(invalidRule).text()).toBe('rules: [');
    await Bun.file(invalidRule).delete();
    const recovered = await run(sandbox.path, command);
    expect(recovered.code, recovered.stdout + recovered.stderr).toBe(0);
}, 120_000);
