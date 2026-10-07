// Native naming contracts follow their configuration, language, category, and scope.
import { join } from 'node:path';
import { renameSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import type { RunReport } from '#cli/types/execution/check.ts';

import {
    BASH_NAMES,
    PYTHON_NAMES,
    FOREIGN_NAMES,
    LIFECYCLE_NAMES,
    FRAMEWORK_CONTRACTS,
} from '#tests/config/cli/checks/general/naming/ownership.ts';

test.each(FRAMEWORK_CONTRACTS)(
    '$configuration native exports and methods preserve parameter and sibling findings',
    async ({ configuration, names, banned }) => {
        await using sandbox = await testdir();
        const source = names.map((name) => `export function ${name}() { return null; }\n`).join('');
        const bindings = names.map((name) => `export const ${name} = () => null;\n`).join('');
        const declarations = names.map((name) => `    ${name}() { return null; }\n`).join('');
        const methods = `export class Reader {\n${declarations}}\n`;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['typescript', 'naming'], {
                level: 'all',
                tables:
                    `[naming]\nbanned = ${JSON.stringify(banned)}\n` +
                    `[[scope]]\npath = "app"\nconfigurations = ["${configuration}"]\n` +
                    '[[scope]]\npath = "sibling"\n',
            }),
            'entry.ts': source,
            'app/entry.ts': source,
            'app/bindings.ts': bindings,
            'app/reader.ts': methods,
            'app/parameters.ts': `export function readValue(${names[0]!}: string) { return null; }\n`,
            'sibling/entry.ts': source,
        });
        const command = ['check', '--only', 'naming/identifiers', '--json'];
        const failed = await runGspot(sandbox.path, command);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(
            (JSON.parse(failed.stdout) as RunReport).checks.flatMap(({ findings }) =>
                findings.map(({ file, line, rule }) => ({ file, line, rule })),
            ),
        ).toStrictEqual([
            ...names.map((_, index) => ({ file: 'entry.ts', line: index + 1, rule: 'banned-term' })),
            { file: 'app/parameters.ts', line: 1, rule: 'banned-term' },
            ...names.map((_, index) => ({ file: 'sibling/entry.ts', line: index + 1, rule: 'banned-term' })),
        ]);
        for (const file of ['entry.ts', 'sibling/entry.ts']) {
            await Bun.write(join(sandbox.path, file), 'export function readValue() { return null; }\n');
        }
        await Bun.write(
            join(sandbox.path, 'app/parameters.ts'),
            'export function readValue(value: string) { return null; }\n',
        );
        const corrected = await runGspot(sandbox.path, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks.every(({ findings }) => findings.length === 0)).toBe(
            true,
        );
        expect(await Bun.file(join(sandbox.path, 'app/entry.ts')).text()).toBe(source);
        expect(await Bun.file(join(sandbox.path, 'app/bindings.ts')).text()).toBe(bindings);
        expect(await Bun.file(join(sandbox.path, 'app/reader.ts')).text()).toBe(methods);
    },
);

test('foreign native names and repository API picks receive ordinary TypeScript checks', async () => {
    await using sandbox = await testdir();
    const source = FOREIGN_NAMES.map((name) => `export function ${name}() { return null; }\n`).join('');
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript', 'naming'], {
            level: 'all',
            tables: `[naming]\nbanned = ${JSON.stringify(FOREIGN_NAMES)}\n`,
        }),
        'entry.ts': source,
    });
    const command = ['check', '--only', 'naming/identifiers', '--json'];
    const failed = await runGspot(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(
        (JSON.parse(failed.stdout) as RunReport).checks.flatMap(({ findings }) =>
            findings.filter(({ rule }) => rule === 'banned-term').map(({ line }) => line),
        ),
    ).toStrictEqual(FOREIGN_NAMES.map((_, index) => index + 1));
    await Bun.write(join(sandbox.path, 'entry.ts'), 'export function readValue() { return null; }\n');
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([{ status: 'passed', findings: [] }]);
});

test('shell variables preserve findings on functions and neighboring local bindings', async () => {
    await using sandbox = await testdir();
    const native = BASH_NAMES.map((name) => `${name}=example\n`).join('');
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash', 'naming'], {
            level: 'all',
            tables: `[naming]\nbanned = ${JSON.stringify(BASH_NAMES)}\n`,
        }),
        'entry.sh': native + 'USER_HELPER=example\nIFS() { echo example; }\n',
    });
    const command = ['check', '--only', 'naming/identifiers', '--json'];
    const failed = await runGspot(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(
        (JSON.parse(failed.stdout) as RunReport).checks.flatMap(({ findings }) =>
            findings.map(({ line, rule }) => ({ line, rule })),
        ),
    ).toStrictEqual([
        { line: BASH_NAMES.length + 1, rule: 'banned-term' },
        { line: BASH_NAMES.length + 2, rule: 'case' },
        { line: BASH_NAMES.length + 2, rule: 'banned-term' },
    ]);
    await Bun.write(join(sandbox.path, 'entry.sh'), native + 'USER_COUNT=example\nread_value() { echo example; }\n');
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([{ status: 'passed', findings: [] }]);
});

test('Swift native type names do not exempt parameters or neighboring declarations', async () => {
    await using sandbox = await testdir();
    const native = 'typealias URLSession = String\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['swift', 'naming'], {
            level: 'all',
            tables: '[naming]\nbanned = ["url session"]\n',
        }),
        'Entry.swift': native + 'let helperCount = 1\nfunc readValue(URLSession: String) {}\n',
    });
    const command = ['check', '--only', 'naming/identifiers', '--json'];
    const failed = await runGspot(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(
        (JSON.parse(failed.stdout) as RunReport).checks.flatMap(({ findings }) =>
            findings.map(({ line, rule }) => ({ line, rule })),
        ),
    ).toStrictEqual([
        { line: 2, rule: 'banned-term' },
        { line: 3, rule: 'banned-term' },
    ]);
    await Bun.write(
        join(sandbox.path, 'Entry.swift'),
        native + 'let entryCount = 1\nfunc readValue(client: String) {}\n',
    );
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([{ status: 'passed', findings: [] }]);
});

test('Python native declarations reach their owning rules while invented dunders and parameters fail', async () => {
    await using sandbox = await testdir();
    const methods = [...PYTHON_NAMES, ...LIFECYCLE_NAMES]
        .map((name) => `    def ${name}(self):\n        pass\n`)
        .join('');
    const native = `__spec__ = None\n__annotations__ = {}\nclass Record:\n${methods}`;
    const inventedLine = 4 + (PYTHON_NAMES.length + LIFECYCLE_NAMES.length) * 2;
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['python', 'naming'], {
            level: 'all',
            tables: `[naming]\nbanned = ${JSON.stringify([...PYTHON_NAMES, ...LIFECYCLE_NAMES])}\n`,
        }),
        'entry.py':
            native + '    def __helper__(self):\n        pass\n    def read_value(self, setUp):\n        pass\n',
    });
    const command = ['check', '--only', 'naming/identifiers', '--json'];
    const failed = await runGspot(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(
        (JSON.parse(failed.stdout) as RunReport).checks.flatMap(({ findings }) =>
            findings.map(({ line, rule }) => ({ line, rule })),
        ),
    ).toStrictEqual([
        { line: inventedLine, rule: 'banned-term' },
        { line: inventedLine + 2, rule: 'banned-term' },
    ]);
    await Bun.write(
        join(sandbox.path, 'entry.py'),
        native + '    def read_record(self):\n        pass\n    def read_value(self, entry):\n        pass\n',
    );
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([{ status: 'passed', findings: [] }]);
});

test('pytest owns test-prefix counting without changing sibling Python contracts', async () => {
    await using sandbox = await testdir();
    const source = 'def test_read_account_summary_columns():\n    pass\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['python', 'naming'], {
            level: 'all',
            tables: '[[scope]]\npath = "app"\nconfigurations = ["pytest"]\n[[scope]]\npath = "sibling"\n',
        }),
        'test_entry.py': source,
        'app/test_entry.py': source,
        'sibling/test_entry.py': source,
    });
    const command = ['check', '--only', 'naming/identifiers', '--json'];
    const failed = await runGspot(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(
        (JSON.parse(failed.stdout) as RunReport).checks.flatMap(({ findings }) =>
            findings.map(({ file, line, rule }) => ({ file, line, rule })),
        ),
    ).toStrictEqual([
        { file: 'test_entry.py', line: 1, rule: 'words' },
        { file: 'sibling/test_entry.py', line: 1, rule: 'words' },
    ]);
    for (const file of ['test_entry.py', 'sibling/test_entry.py']) {
        await Bun.write(join(sandbox.path, file), 'def read_account_summary_columns():\n    pass\n');
    }
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks.every(({ findings }) => findings.length === 0)).toBe(
        true,
    );
    expect(await Bun.file(join(sandbox.path, 'app/test_entry.py')).text()).toBe(source);
});

test('Python module filenames preserve the neighboring TypeScript filename contract', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['python', 'typescript', 'naming'], { level: 'all' }),
        'python/__init__.py': '"""Package entry."""\n',
        'python/__main__.py': '"""Program entry."""\n',
        'javascript/__init__.ts': 'export const entry = 1;\n',
    });
    const command = ['check', '--only', 'naming/paths', '--json'];
    const failed = await runGspot(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect((JSON.parse(failed.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toMatchObject([
        { file: 'javascript/__init__.ts', line: 1, column: 1, rule: 'case' },
    ]);
    renameSync(join(sandbox.path, 'javascript/__init__.ts'), join(sandbox.path, 'javascript/entry.ts'));
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([{ status: 'passed', findings: [] }]);
    expect(await Bun.file(join(sandbox.path, 'python/__init__.py')).text()).toBe('"""Package entry."""\n');
    expect(await Bun.file(join(sandbox.path, 'python/__main__.py')).text()).toBe('"""Program entry."""\n');
});
