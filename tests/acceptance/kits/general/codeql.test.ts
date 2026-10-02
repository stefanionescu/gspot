import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import { toolsPath } from '#tests/harness/tools/install.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { toolShipsHere } from '#tests/harness/cli/platforms.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';

const python = {
    language: 'python',
    file: 'query.py',
    unsafe: 'from flask import request\nimport sqlite3\n\ndef query():\n    value = request.args.get("name")\n    sqlite3.connect("db.sqlite").execute("SELECT * FROM users WHERE name = " + value)\n',
    corrected:
        'from flask import request\nimport sqlite3\n\ndef query():\n    value = request.args.get("name")\n    sqlite3.connect("db.sqlite").execute("SELECT * FROM users WHERE name = ?", (value,))\n',
    rule: 'py/sql-injection',
    line: 6,
    column: 42,
};

// CodeQL ships no arm64 Linux build; its pin says where it runs.
describe.if(toolShipsHere('codeql'))('the pinned CodeQL', () => {
    test(
        'pinned CodeQL reports SQL injection in Python and accepts a parameterized query without changing sources',
        async () => {
            const { language, file, unsafe, corrected, rule, line, column } = python;
            await using directory = await testdir();
            await createFileTree(directory.path, {
                'gspot.toml': policyOf(['security'], `[tools.codeql]\nlanguages = ["${language}"]\n`, 'all'),
                [file]: unsafe,
                'authored.txt': 'Preserve this file.\n',
            });
            const environment = { PATH: toolsPath(['codeql']) };
            const command = ['check', '--only', 'security/codeql', '--json'];
            const planted = await spawnGspot(directory.path, command, environment);
            expect(planted.code, planted.stdout + planted.stderr).toBe(1);
            const report = JSON.parse(planted.stdout) as RunReport;
            expect(report.checks).toMatchObject([{ check: 'security/codeql', status: 'fail' }]);
            expect(report.checks.flatMap((check) => check.findings)).toMatchObject([
                { check: 'security/codeql', rule, file, line, column },
            ]);
            expect(readFileSync(join(directory.path, file), 'utf8')).toBe(unsafe);
            await Bun.write(join(directory.path, file), corrected);
            const fixed = await spawnGspot(directory.path, command, environment);
            expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
            const fixedReport = JSON.parse(fixed.stdout) as RunReport;
            expect(fixedReport.checks).toMatchObject([{ check: 'security/codeql', status: 'ok', findings: [] }]);
            expect(readFileSync(join(directory.path, file), 'utf8')).toBe(corrected);
            expect(readFileSync(join(directory.path, 'authored.txt'), 'utf8')).toBe('Preserve this file.\n');
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
