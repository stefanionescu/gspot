import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildToolsPath } from '#tests/harness/install.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { runTestCommandBlocking } from '#tests/harness/command.ts';
import { sharePythonTools } from '#tests/harness/python-installation.ts';

import {
    RULE_CODES,
    FORMAT_CASES,
    ENABLED_RULES,
    VERSION_CASES,
    VERSION_SOURCE,
    FUNCTION_SOURCE,
    RULE_SELECTIONS,
    DUPLICATE_SOURCE,
    DOCSTRING_CONVENTIONS,
} from '#tests/config/tools/configurations/language/python/ruff.ts';

test('Python uses one function-size ceiling without a second statement-count finding', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['python'], { level: 'all' }),
        'sample.py': FUNCTION_SOURCE,
    });
    const session = await openSession(sandbox.path);
    using log = openOwnership(sandbox.path);
    writeGeneratedFiles(session, emitAll(session), log);
    const checked = runTestCommandBlocking(
        ['ruff', 'check', '--config', '.gspot/config/ruff.toml', '--no-cache', '--output-format', 'json', 'sample.py'],
        { cwd: sandbox.path, env: { PATH: buildToolsPath(['ruff']) } },
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(JSON.parse(checked.stdout)).toStrictEqual([]);
    const sized = await spawnGspot(sandbox.path, ['check', '--only', 'python/function-size', '--json']);
    expect(sized.code, sized.stdout + sized.stderr).toBe(0);
    expect((JSON.parse(sized.stdout) as RunReport).checks).toMatchObject([
        { check: 'python/function-size', status: 'passed', findings: [] },
    ]);
});

test('Ruff editor discovery and explicit formatting agree on root and nested policy', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['python'], {
            tables: '[format]\nquotes = "single"\nline_ending = "crlf"\n[scope."app"]\n[scope."app".format]\nquotes = "double"\nline_ending = "lf"\n',
        }),
        'sample.py': 'VALUE = "example"\n',
        'app/sample.py': 'VALUE = "example"\n',
    });
    const session = await openSession(sandbox.path);
    using log = openOwnership(sandbox.path);
    writeGeneratedFiles(session, emitAll(session), log);
    for (const { file, config, formatted } of FORMAT_CASES) {
        const options = { cwd: sandbox.path, env: { PATH: buildToolsPath(['ruff']) } };
        const fixed = runTestCommandBlocking(['ruff', 'format', '--config', config, '--no-cache', file], options);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, file)).text()).toBe(formatted);
        const editor = runTestCommandBlocking(['ruff', 'format', '--check', '--no-cache', file], options);
        expect(editor.code, editor.stdout + editor.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, file)).text()).toBe(formatted);
    }
});

test.each(['recommended', 'all'] as const)('Ruff fixes respect each project Python version at %s', async (level) => {
    await using sandbox = await testdir();
    const tables = VERSION_CASES.filter(({ scope }) => scope !== '')
        .map(({ scope }) => `[scope."${scope}"]\n`)
        .join('');
    const files = Object.fromEntries(
        VERSION_CASES.flatMap(({ scope, requires }) => [
            [
                join(scope, 'pyproject.toml'),
                `[project]\nname = "version-example"\nversion = "1.0.0"\nrequires-python = "${requires}"\n`,
            ],
            [join(scope, 'sample.py'), VERSION_SOURCE],
        ]),
    );
    await createFileTree(sandbox.path, { 'gspot.toml': buildPolicy(['python'], { level, tables }), ...files });
    const applied = await spawnGspot(sandbox.path, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const environment = await sharePythonTools(sandbox.path);
    const command = ['check', '--only', 'python/ruff', '--json'];
    const checked = await spawnGspot(sandbox.path, command, environment);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const report = JSON.parse(checked.stdout) as RunReport;
    for (const { scope, generics, unions } of VERSION_CASES) {
        const found = report.checks.find((entry) => entry.scope === scope)!.findings;
        expect(
            found.some(({ rule }) => rule === 'UP006'),
            scope || 'root',
        ).toBe(generics);
        expect(
            found.some(({ rule }) => rule === 'UP045'),
            scope || 'root',
        ).toBe(unions);
    }
    const fixed = await spawnGspot(sandbox.path, [...command, '--fix'], environment);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(1);
    const fixedReport = JSON.parse(fixed.stdout) as RunReport;
    for (const { scope, annotation } of VERSION_CASES) {
        const text = await Bun.file(join(sandbox.path, scope, 'sample.py')).text();
        expect(text, scope).toContain(annotation);
        const result = fixedReport.checks.find((entry) => entry.scope === scope)!;
        expect(result.status, scope).toBe(scope === 'modern' ? 'passed' : 'failed');
        expect(
            result.findings.every(({ fixable }) => !fixable),
            scope || 'root',
        ).toBe(true);
    }
});

test.each(['recommended', 'all'] as const)(
    'Python diagnostics keep one unused-import owner and retain type errors at %s',
    async (level) => {
        await using sandbox = await testdir({
            'gspot.toml': buildPolicy(['python'], { level }),
            'sample.py': DUPLICATE_SOURCE,
        });
        const applied = await spawnGspot(sandbox.path, ['apply', '--json']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const environment = await sharePythonTools(sandbox.path);
        const command = ['check', '--only', 'python/ruff', 'python/basedpyright', '--json'];
        const checked = await spawnGspot(sandbox.path, command, environment);
        expect(checked.code, checked.stdout + checked.stderr).toBe(1);
        const report = JSON.parse(checked.stdout) as RunReport;
        expect(
            report.checks.flatMap(({ findings }) =>
                findings.map(({ check, file, line, rule }) => ({ check, file, line, rule })),
            ),
        ).toStrictEqual([
            { check: 'python/ruff', file: 'sample.py', line: 3, rule: 'F401' },
            { check: 'python/basedpyright', file: 'sample.py', line: 5, rule: 'reportAssignmentType' },
        ]);
        await Bun.write(join(sandbox.path, 'sample.py'), '"""An example module."""\n\nTOTAL: int = 1\n');
        const corrected = await spawnGspot(sandbox.path, command, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toStrictEqual(
            [],
        );
    },
);

test.each(['recommended', 'all'] as const)(
    '%s Ruff prefixes retain the native rules in root and child projects with every docstring convention',
    async (level) => {
        for (const convention of DOCSTRING_CONVENTIONS) {
            await using sandbox = await testdir({
                'gspot.toml': buildPolicy(['python'], {
                    level,
                    tables: `[tools.ruff]
docstring_convention = "${convention}"
[scope.app]
configurations = ["pytest", "fastapi"]
[[ignore]]
check = "python/ruff"
rule = "F401"
reason = "The import has an external side effect."
`,
                }),
                'sample.py': 'VALUE = 1\n',
                'app/sample.py': 'VALUE = 1\n',
            });
            const session = await openSession(sandbox.path);
            using log = openOwnership(sandbox.path);
            writeGeneratedFiles(session, emitAll(session), log);
            for (const scope of ['root', 'app'] as const) {
                const folder = scope === 'root' ? '' : scope;
                const config = join('.gspot/config', folder, 'ruff.toml');
                const result = runTestCommandBlocking(
                    ['ruff', 'check', '--config', config, '--show-settings', join(folder, 'sample.py')],
                    { cwd: sandbox.path, env: { PATH: buildToolsPath(['ruff']) } },
                );
                expect(result.code, result.stderr).toBe(0);
                const selected = ENABLED_RULES.exec(result.stdout);
                expect(selected).not.toBeNull();
                const codes = [...selected![1]!.matchAll(RULE_CODES)]
                    .map((match) => match[1]!)
                    .toSorted((left, right) => left.localeCompare(right));
                const digest = createHash('sha256').update(codes.join('\n')).digest('hex');
                expect(codes).toHaveLength(RULE_SELECTIONS[level][scope].count);
                expect(digest).toBe(RULE_SELECTIONS[level][scope].digest);
            }
        }
    },
);
