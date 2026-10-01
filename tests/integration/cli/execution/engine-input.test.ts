import * as fs from 'node:fs';
import { join } from 'node:path';
import { rmSync, existsSync } from 'node:fs';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { readSource } from '#cli/repository/tracked.ts';
import { onPosix } from '#tests/support/cli/platforms.ts';
import { containing } from '#tests/support/expectations.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { scratchCopy } from '#cli/execution/files/workspace.ts';
import { scriptIndex } from '#cli/checks/bash/cross-file-index.ts';
import { planRun, ownedInputs } from '#cli/execution/planning/plan.ts';
import { engineInput, runEngineCheck } from '#cli/execution/engines.ts';

test.each([
    {
        language: 'python',
        path: 'source.py',
        structural: 'python/trivial-function',
        // Ruff owns case now, so the naming defect is a name over the word ceiling.
        defect: 'def read_source_entries_from_files_now():\n    return 1\n',
        corrected:
            'def read_entries(source):\n    text = source.read()\n    entries = text.splitlines()\n    return entries\n',
    },
    {
        language: 'swift',
        path: 'Source.swift',
        structural: 'swift/trivial-function',
        defect: 'func readSourceEntriesFromFilesNow() -> Int { 1 }\n',
        corrected:
            'func readLines(_ source: String) -> [String] {\n    let trimmed = source.trimmingCharacters(in: .whitespaces)\n    let lines = trimmed.components(separatedBy: "\\n")\n    return lines\n}\n',
    },
    {
        language: 'bash',
        path: 'source.sh',
        structural: 'structure/trivial-function',
        defect: 'BadName() { echo ready; }\n',
        corrected:
            'read_lines() {\n    local source="$1"\n    printf "%s\\n" "$source"\n    printf "%s\\n" "Complete"\n}\n',
    },
])(
    '$language naming and structure share parses without invalidating readers or later runs',
    async ({ language, path, structural, defect, corrected }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf([language, 'naming'], '', 'all'),
            [path]: defect,
        });
        const session = await openSession(sandbox.path);
        const options = {
            stage: 'all' as const,
            only: ['naming/identifiers', structural],
            skips: [],
            fix: false,
            isDryRun: true,
        };
        const failed = await executeRun(session, options);
        expect(failed.report.exitCode, JSON.stringify(failed.report)).toBe(1);
        expect(failed.report.checks.map((check) => check.status)).toStrictEqual(['fail', 'fail']);
        for (const check of failed.report.checks)
            expect(check.findings).toContainEqual(containing({ file: path, line: 1 }));
        expect(await Bun.file(join(sandbox.path, path)).text()).toBe(defect);
        await Bun.write(join(sandbox.path, path), corrected);
        const accepted = await executeRun(session, options);
        expect(accepted.report.exitCode, JSON.stringify(accepted.report)).toBe(0);
        expect(accepted.report.checks).toMatchObject([
            { status: 'ok', findings: [] },
            { status: 'ok', findings: [] },
        ]);
        expect(await Bun.file(join(sandbox.path, path)).text()).toBe(corrected);
    },
);

test('engine inputs expose selected files and reserve the repository inventory for once-only checks', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['jest', 'docs'], '[[scope]]\npath = "apps/web"\n'),
        'README.md': '# Repository\n',
        'apps/web/value.test.js': 'test("value", () => expect(1).toBe(1));\n',
        'apps/web/fixture.bin': new Uint8Array([0, 255, 0]),
        'apps/web/jest.config.json': '{"testEnvironment":"node"}',
        'unrelated/private.txt': 'Sibling input\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planRun(session, {
        stage: 'all',
        skips: [],
        only: ['jest/coverage', 'integrity/stale-paths'],
    });
    const project = planned.find((entry) => entry.check === 'jest/coverage' && entry.scope.scope.path === 'apps/web')!;
    const scopeInput = engineInput(session, project);
    expect(ownedInputs(session, project).map((file) => file.path)).toStrictEqual(['apps/web/value.test.js']);
    expect(scopeInput.scopeRoot).toBe(join(sandbox.path, 'apps/web'));
    expect(
        scopeInput.files.map((file) => file.path).toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual(['apps/web/fixture.bin', 'apps/web/jest.config.json', 'apps/web/value.test.js']);
    const leaked = await runEngineCheck(
        session,
        () => Promise.resolve({ findings: [], checkedFiles: ['unrelated/private.txt'] }),
        project,
    );
    expect(leaked.status).toBe('error');
    const owned = await runEngineCheck(
        session,
        () => Promise.resolve({ findings: [], checkedFiles: ['apps/web/value.test.js'] }),
        project,
    );
    expect(owned).toMatchObject({ status: 'ok', checkedFiles: ['apps/web/value.test.js'] });
    const scratch = await scratchCopy(
        scopeInput.root,
        scopeInput.files.map((file) => file.path),
        ['apps/web'],
    );
    try {
        expect(existsSync(join(scratch, 'apps/web/fixture.bin'))).toBe(true);
        expect(existsSync(join(scratch, 'apps/web/jest.config.json'))).toBe(true);
        expect(existsSync(join(scratch, 'unrelated/private.txt'))).toBe(false);
        expect(existsSync(join(scratch, 'README.md'))).toBe(false);
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
});

// Windows file names cannot hold a newline or a quote.
if (onPosix)
    test('shell reads distinguish filename lists containing newlines', async () => {
        await using sandbox = await testdir();
        const names = ['a.sh', 'b.sh\nc.sh', 'a.sh\nb.sh', 'c.sh'];
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(['bash']),
            ...Object.fromEntries(
                names.map((name, index) => [name, `function name${String(index)}() { echo ${String(index)}; }\n`]),
            ),
        });
        const session = await openSession(sandbox.path);
        const scope = session.scopes[0]!;
        const request = engineInput(session, {
            scope,
            spec: session.manifests.get('bash')!.checks[0]!,
            files: session.repository.files,
        });
        const files = names.map((path) => session.repository.files.find((file) => file.path === path)!);
        const first = await scriptIndex(request, files.slice(0, 2));
        const second = await scriptIndex(request, files.slice(2));
        expect(first.files.map((file) => file.path)).toStrictEqual(names.slice(0, 2));
        expect(second.files.map((file) => file.path)).toStrictEqual(names.slice(2));
        expect([...second.owners.keys()]).toStrictEqual(['name2', 'name3']);
    });

test('project type checking belongs to push and preserves explicit selection', async () => {
    const check = 'typescript/tsc';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['typescript']),
        'source.ts': 'export const value = 1;\n',
    });
    const session = await openSession(sandbox.path);
    const commit = planRun(session, { stage: 'commit', skips: [], only: [check] });
    expect(commit.map((entry) => entry.check)).not.toContain(check);
    for (const stage of ['push', 'all'] as const) {
        const planned = planRun(session, { stage, skips: [], only: [check] });
        expect(planned.map((entry) => entry.check)).toContain(check);
        expect(planned.find((entry) => entry.check === check)?.spec.stage).toBe('push');
    }
});

// Windows file names cannot hold a newline or a quote.
if (onPosix)
    test('engines share source bytes within a run and refresh reused sessions after corrections', async () => {
        await using sandbox = await testdir();
        const path = 'app/café\nquery.sql';
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(['sql'], '[[scope]]\npath = "app"\n', 'all'),
            [path]: 'select 1;\n',
        });
        const session = await openSession(sandbox.path);
        const options = {
            stage: 'all' as const,
            skips: [],
            only: ['sql/syntax', 'sql/block-comments', 'sql/file-length'],
            fix: false,
            isDryRun: true,
        };
        const read = spyOn(fs, 'readFileSync');
        try {
            const clean = await executeRun(session, options);
            expect(clean.report.exitCode).toBe(0);
            expect(
                clean.report.checks
                    .filter((check) => check.scope === 'app')
                    .map((check) => check.check)
                    .toSorted((left, right) => left.localeCompare(right)),
            ).toStrictEqual(['sql/block-comments', 'sql/file-length', 'sql/syntax']);
            expect(read.mock.calls.filter(([file]) => file === join(sandbox.path, path))).toHaveLength(1);
            read.mockClear();
            await Bun.write(join(sandbox.path, path), 'select from;\n');
            const defect = await executeRun(session, options);
            expect(defect.report.exitCode).toBe(1);
            expect(defect.report.checks.flatMap((check) => check.findings)).toContainEqual(
                containing({ file: path, line: 1 }),
            );
            expect(read.mock.calls.filter(([file]) => file === join(sandbox.path, path))).toHaveLength(1);
            read.mockClear();
            await Bun.write(join(sandbox.path, path), 'select 2;\n');
            const corrected = await executeRun(session, options);
            expect(corrected.report.exitCode).toBe(0);
            expect(read.mock.calls.filter(([file]) => file === join(sandbox.path, path))).toHaveLength(1);
        } finally {
            read.mockRestore();
        }
        expect(await Bun.file(join(sandbox.path, path)).text()).toBe('select 2;\n');
    });

test('source reads never cache isolated output or turn failed reads into success', async () => {
    await using sandbox = await testdir();
    await using scratch = await testdir();
    await createFileTree(sandbox.path, { 'source.txt': 'original' });
    await createFileTree(scratch.path, { 'source.txt': 'before generation' });
    const reads = { root: sandbox.path, sources: new Map<string, Buffer>() };
    expect(readSource(sandbox.path, 'source.txt', reads).toString()).toBe('original');
    expect(readSource(scratch.path, 'source.txt', reads).toString()).toBe('before generation');
    await Bun.write(join(scratch.path, 'source.txt'), 'after generation');
    expect(readSource(scratch.path, 'source.txt', reads).toString()).toBe('after generation');
    expect(() => readSource(sandbox.path, 'missing.txt', reads)).toThrow();
    await Bun.write(join(sandbox.path, 'missing.txt'), 'recovered');
    expect(readSource(sandbox.path, 'missing.txt', reads).toString()).toBe('recovered');
    expect(await Bun.file(join(sandbox.path, 'source.txt')).text()).toBe('original');
});

test('fix verification replaces read source bytes and preserves unrelated authored files', async () => {
    await using sandbox = await testdir();
    const policy = `kits = ["sql"]
[[check]]
name = "project/correct-sql"
command = [${JSON.stringify(process.execPath)}, "-e", "process.exitCode = 0"]
paths = ["query.sql"]
stage = "commit"
fix_command = [${JSON.stringify(process.execPath)}, "correct.cjs", "{files}"]
[check.output]
format = "none"
`;
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        'query.sql': 'select from;\n',
        'notes.txt': 'Authored notes.\n',
        'correct.cjs': String.raw`const fs = require("node:fs"); for (const path of process.argv.slice(2)) fs.writeFileSync(path, "select 1;\n");`,
    });
    const session = await openSession(sandbox.path);
    const options = {
        stage: 'all' as const,
        skips: [],
        only: ['sql/syntax', 'project/correct-sql'],
        fix: false,
        isDryRun: false,
    };
    const defect = await executeRun(session, options);
    expect(defect.report.exitCode).toBe(1);
    expect(defect.report.checks.flatMap((check) => check.findings)).toContainEqual(
        containing({ file: 'query.sql', line: 1 }),
    );
    const corrected = await executeRun(session, { ...options, fix: true });
    expect(corrected.report.exitCode).toBe(0);
    expect(corrected.report.checks.map(({ check, status, findings }) => ({ check, status, findings }))).toStrictEqual([
        { check: 'sql/syntax', status: 'ok', findings: [] },
        { check: 'project/correct-sql', status: 'ok', findings: [] },
    ]);
    expect(await Bun.file(join(sandbox.path, 'query.sql')).text()).toBe('select 1;\n');
    expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
    expect(await Bun.file(join(sandbox.path, 'notes.txt')).text()).toBe('Authored notes.\n');
});
