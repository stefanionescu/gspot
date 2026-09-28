import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { toolsPath } from '#tests/support/cli/tools.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/cli.ts';
import { toolShipsHere } from '#tests/support/cli/platforms.ts';

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
const javascript = {
    language: 'javascript-typescript',
    file: 'query.js',
    unsafe: 'const express = require("express");\nconst mysql = require("mysql");\nconst connection = mysql.createConnection({});\nconst rateLimit = require("express-rate-limit");\nconst app = express();\napp.use(rateLimit({windowMs: 60000, max: 100}));\napp.get("/users", (request, response) => {\n    connection.query("SELECT * FROM users WHERE name = " + request.query.name, (error, result) => response.send(result));\n});\n',
    corrected:
        'const express = require("express");\nconst mysql = require("mysql");\nconst connection = mysql.createConnection({});\nconst rateLimit = require("express-rate-limit");\nconst app = express();\napp.use(rateLimit({windowMs: 60000, max: 100}));\napp.get("/users", (request, response) => {\n    connection.query("SELECT * FROM users WHERE name = ?", [request.query.name], (error, result) => response.send(result));\n});\n',
    rule: 'js/sql-injection',
    line: 8,
    column: 22,
};

// CodeQL ships no arm64 Linux build; its pin says where it runs.
describe.if(toolShipsHere('codeql'))('the pinned CodeQL', () => {
    test.each(
        ['recommended', 'all'].flatMap((level) => [python, javascript].map((example) => ({ level, ...example }))),
    )(
        'pinned CodeQL reports SQL injection for $language at $level and accepts a parameterized query without changing sources',
        async ({ level, language, file, unsafe, corrected, rule, line, column }) => {
            await using directory = await testdir();
            await createFileTree(directory.path, {
                'gspot.toml': `version = 1\nlevel = "${level}"\nkits = ["security"]\n[tools.codeql]\nlanguages = ["${language}"]\n`,
                [file]: unsafe,
                'authored.txt': 'Preserve this file.\n',
            });
            const environment = { PATH: toolsPath(['codeql']) };
            const command = ['check', '--stage', 'manual', '--only', 'security/codeql', '--no-cache', '--json'];
            const planted = await run(directory.path, command, environment);
            expect(planted.code, planted.stdout + planted.stderr).toBe(1);
            const report = reportSchema.parse(JSON.parse(planted.stdout));
            expect(report.checks).toMatchObject([{ check: 'security/codeql', status: 'fail' }]);
            expect(report.checks.flatMap((check) => check.findings)).toMatchObject([
                { check: 'security/codeql', rule, file, line, column },
            ]);
            expect(readFileSync(join(directory.path, file), 'utf8')).toBe(unsafe);
            await Bun.write(join(directory.path, file), corrected);
            const fixed = await run(directory.path, command, environment);
            expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
            const fixedReport = reportSchema.parse(JSON.parse(fixed.stdout));
            expect(fixedReport.checks).toMatchObject([{ check: 'security/codeql', status: 'ok', findings: [] }]);
            expect(readFileSync(join(directory.path, file), 'utf8')).toBe(corrected);
            expect(readFileSync(join(directory.path, 'authored.txt'), 'utf8')).toBe('Preserve this file.\n');
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
