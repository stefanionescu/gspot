import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { containing } from '#tests/support/expectations.ts';
import { installSemgrep } from '#tests/support/cli/tools.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';

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
    await installSemgrep(sandbox.path);
    const command = ['check', '--only', 'security/semgrep', '--no-cache', '--json'];
    const broken = await run(sandbox.path, command);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    const findingsByScope = (JSON.parse(broken.stdout) as RunReport).checks.flatMap(({ scope, findings }) =>
        findings.map((finding) => ({ scope, finding })),
    );
    expect(findingsByScope).toStrictEqual([
        {
            scope: 'app',
            finding: containing({ file: 'app/source.js', line: 1, rule: 'express-res-send-raw-input' }),
        },
        {
            scope: 'app/child',
            finding: containing({
                file: 'app/child/source.js',
                line: 1,
                rule: 'express-res-send-raw-input',
            }),
        },
        {
            scope: 'sibling',
            finding: containing({ file: 'sibling/ignored.js', line: 1, rule: 'node-no-eval' }),
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

test('a module-loading exception preserves other security rules and neighboring module findings', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'version = 1\nconfigurations = ["javascript", "security"]\n[[ignore]]\ncheck = "security/semgrep"\nrule = "node-no-configured-require"\npaths = ["configuration.js"]\nreason = "The configuration evaluator loads repository-selected modules."\n',
        'configuration.js': 'await import(modulePath);\neval(input);\n',
        'neighbor.js': 'await import(modulePath);\n',
    });
    await installSemgrep(sandbox.path);
    const command = ['check', '--only', 'security/semgrep', '--no-cache', '--json'];
    const broken = await run(sandbox.path, command);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect((JSON.parse(broken.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toStrictEqual([
        containing({ file: 'configuration.js', line: 2, rule: 'node-no-eval' }),
        containing({ file: 'neighbor.js', line: 1, rule: 'node-no-configured-require' }),
    ]);
    await Bun.write(join(sandbox.path, 'configuration.js'), 'await import(modulePath);\nJSON.parse(input);\n');
    await Bun.write(join(sandbox.path, 'neighbor.js'), 'await import("node:fs");\n');
    const corrected = await run(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
}, 120_000);
