import { z } from 'zod';
import { join } from 'node:path';
import { parse } from 'smol-toml';
import { test, expect, beforeAll } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { containingAll } from '#tests/harness/expectations.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { runTestCommandBlocking } from '#tests/harness/command.ts';
import type { RuffFinding } from '#tests/types/tools/configurations/python.ts';
import { RULE_SOURCE } from '#tests/config/tools/configurations/language/python/ruff.ts';

let previewCodes: string[];
beforeAll(() => {
    const result = runTestCommandBlocking(['ruff', 'rule', '--all', '--output-format', 'json'], { cwd: process.cwd() });
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const rules = z
        .array(z.object({ code: z.string().nullable(), preview: z.boolean() }))
        .parse(JSON.parse(result.stdout));
    previewCodes = rules.flatMap(({ code, preview }) => (code !== null && preview ? [code] : []));
    expect(previewCodes.length).toBeGreaterThan(0);
});

test('Ruff keeps pytest rules and scoped limits inside their selected project', async () => {
    await using sandbox = await testdir();
    const sample =
        '"""Fixture declarations."""\n\nimport pytest\n\n\n@pytest.fixture()\ndef example() -> int:\n    """Provide a reusable value."""\n    return 1\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['python'], {
            level: 'all',
            tables: '[scope."app"]\nconfigurations = ["pytest"]\n[scope."app".limits.python]\nfunction_parameters = 3\n[[ignore]]\ncheck = "python/ruff"\nrule = "S101"\npaths = ["app/tests/**"]\nreason = "Test assertions deliberately verify the behavior."\n',
        }),
        'tests/__init__.py': '"""Root test package."""\n',
        'app/__init__.py': '"""Application package."""\n',
        'app/tests/__init__.py': '"""Application test package."""\n',
        'tests/test_example.py': sample,
        'app/tests/test_example.py': sample,
    });
    const session = await openSession(sandbox.path);
    const emitted = emitAll(session);
    const configs = emitted.files.filter(({ path }) => path.startsWith('.gspot/') && path.endsWith('/ruff.toml'));
    expect(configs.map(({ path }) => path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        '.gspot/config/app/ruff.toml',
        '.gspot/config/ruff.toml',
    ]);
    using log = openOwnership(sandbox.path);
    writeGeneratedFiles(session, emitted, log);
    const app = parse(configs.find(({ path }) => path === '.gspot/config/app/ruff.toml')!.content);
    expect(app).toMatchObject({ lint: { select: containingAll(['PT001']) } });

    const run = (path: string) =>
        runTestCommandBlocking(['ruff', 'check', '--no-cache', '--output-format', 'json', path], {
            cwd: sandbox.path,
        });
    const unselected = run('tests/test_example.py');
    expect(unselected.code, unselected.stdout + unselected.stderr).toBe(0);
    const failed = run('app/tests/test_example.py');
    expect(failed.code, failed.stderr).toBe(1);
    expect(JSON.parse(failed.stdout)).toMatchObject([{ code: 'PT001' }]);
    await Bun.write(
        join(sandbox.path, 'app/tests/test_example.py'),
        sample.replace('@pytest.fixture()', '@pytest.fixture'),
    );
    const corrected = run('app/tests/test_example.py');
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    for (const path of ['tests/test_example.py', 'app/tests/test_example.py'])
        await Bun.write(join(sandbox.path, path), '"""An assertion example."""\n\nassert True\n');
    const rootAssertion = run('tests/test_example.py');
    expect(rootAssertion.code, rootAssertion.stderr).toBe(1);
    expect(JSON.parse(rootAssertion.stdout)).toMatchObject([{ code: 'S101' }]);
    const testAssertion = run('app/tests/test_example.py');
    expect(testAssertion.code, testAssertion.stderr).toBe(0);
});

test.each(['recommended', 'all'] as const)(
    'Ruff keeps correctness at %s and runs print conventions only at all',
    async (level) => {
        await using sandbox = await testdir({
            'gspot.toml': buildPolicy(['python'], { level }),
            'sample.py': RULE_SOURCE,
        });
        const session = await openSession(sandbox.path);
        using log = openOwnership(sandbox.path);
        writeGeneratedFiles(session, emitAll(session), log);
        const command = [
            'ruff',
            'check',
            '--config',
            '.gspot/config/ruff.toml',
            '--no-cache',
            '--output-format',
            'json',
            'sample.py',
        ];
        const config = z
            .object({ lint: z.object({ select: z.array(z.string()) }) })
            .parse(parse(await Bun.file(join(sandbox.path, '.gspot/config/ruff.toml')).text()));
        expect(config.lint.select.filter((code) => previewCodes.includes(code))).toStrictEqual([]);
        const result = runTestCommandBlocking(command, { cwd: sandbox.path });
        expect(result.code, result.stdout + result.stderr).toBe(1);
        const findings = JSON.parse(result.stdout) as RuffFinding[];
        expect(
            findings
                .filter(({ code }) => ['F821', 'T201'].includes(code))
                .map(({ code, location }) => [code, location.row]),
        ).toStrictEqual(
            level === 'all'
                ? [
                      ['F821', 1],
                      ['T201', 2],
                  ]
                : [['F821', 1]],
        );
        await Bun.write(join(sandbox.path, 'sample.py'), '"""An arithmetic example."""\n\nanswer = 42\n');
        const corrected = runTestCommandBlocking(command, { cwd: sandbox.path });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(JSON.parse(corrected.stdout)).toStrictEqual([]);
    },
);
