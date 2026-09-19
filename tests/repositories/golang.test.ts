// Planted repository for the go preset: hand-made layout, an unchecked error, an untidy module, a long file, a long function, a reached vulnerability.
import { join } from 'node:path';
import { createFixture } from 'fs-fixture';
import type { PlantedCase } from '#types/run.ts';
import { describe, expect, test } from 'bun:test';
import { chmodSync, mkdirSync, rmSync } from 'node:fs';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
    'go',
    '--without',
    'naming,spelling',
    '--runner',
    'none',
    '--ci',
    'none',
    '--hooks',
    'none',
    '--no-rules',
    '--no-install',
];
const RUNS = 0o755;
const LONG_FUNCTION_LINES = 70;
const LONG_FILE_FUNCTIONS = 120;
const MODULE = 'module example.com/planted\n\ngo 1.25\n';
const HEAD = '// Package planted holds the arithmetic the planted tests call.\npackage planted\n';
const CLEAN = `${HEAD}\n// Double returns twice the number.\nfunc Double(value int) int {\n\treturn value * 2\n}\n`;
const UNCHECKED = `${HEAD}\nimport "os"\n\n// Remove deletes a file and tells nobody how it went.\nfunc Remove(path string) {\n\tos.Remove(path)\n}\n`;
const steps = Array.from({ length: LONG_FUNCTION_LINES }, (_unused, index) => `\ttotal += ${String(index)}`).join('\n');
const LONG_FUNCTION = `${HEAD}\n// Sum adds many numbers one line at a time.\nfunc Sum() int {\n\ttotal := 0\n${steps}\n\treturn total\n}\n`;
const many = Array.from(
    { length: LONG_FILE_FUNCTIONS },
    (_unused, index) =>
        `// Step${String(index)} returns its own number.\nfunc Step${String(index)}() int {\n\treturn ${String(index)}\n}\n`,
).join('\n');
// What govulncheck prints for one vulnerability the code reaches, and the exit code it ends with.
const REACHED = [
    '=== Symbol Results ===',
    '',
    'Vulnerability #1: GO-2021-0113',
    '    Out-of-bounds read in golang.org/x/text/language',
    '  More info: https://pkg.go.dev/vuln/GO-2021-0113',
    '  Module: golang.org/x/text',
    '    Found in: golang.org/x/text@v0.3.0',
    '    Fixed in: golang.org/x/text@v0.3.7',
    '',
    'Your code is affected by 1 vulnerability from 1 module.',
].join('\n');
const SCANNER = `#!/bin/sh\ncat <<'REPORT'\n${REACHED}\nREPORT\nexit 3\n`;

const CASES: PlantedCase[] = [
    {
        id: 'go/gofmt',
        files: { 'wide.go': `${HEAD}\n// Wide is laid out by hand.\nfunc Wide( value int ) int { return value }\n` },
        expected: 'not formatted the way gofmt formats it',
    },
    { id: 'go/golangci-lint', files: { 'remove.go': UNCHECKED }, expected: 'errcheck' },
    {
        id: 'go/mod-tidy',
        files: { 'go.mod': `${MODULE}\nrequire golang.org/x/text v0.3.0\n` },
        expected: 'go mod tidy changes this module',
    },
    { id: 'go/function-length', files: { 'sum.go': LONG_FUNCTION }, expected: 'Sum is 74 lines long' },
    { id: 'go/file-length', files: { 'steps.go': `${HEAD}\n${many}` }, expected: 'code lines, and the ceiling is 300' },
];

describe('the go preset', () => {
    test(
        'every go check fires on its planted defect',
        async () => {
            await using fixture = await createFixture({ 'go.mod': MODULE, 'math.go': CLEAN });
            commitAll(fixture.path);
            const environment = { PATH: toolsPath(['golangci-lint', 'govulncheck', 'typos', 'ec']) };
            await install(fixture.path, INIT, environment);
            for (const planted of CASES) {
                const clean = run(fixture.path, ['check', planted.id, '--no-cache'], environment);
                expect(clean.code, `${planted.id}: ${clean.stdout}${clean.stderr}`).toBe(0);
                const outcome = await runPlanted(fixture.path, planted, environment);
                expect(outcome.code, `${planted.id}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.stdout + outcome.stderr, planted.id).toContain(planted.expected);
            }
        },
        PLANTED_TIMEOUT_MS * 6,
    );

    test(
        'a vulnerability the code reaches is a finding that names the module and the fixed version',
        async () => {
            await using fixture = await createFixture({ 'go.mod': MODULE, 'math.go': CLEAN });
            // The real scanner needs the network and a vulnerable module, so a script prints what it prints.
            await using tools = await createFixture({});
            const bin = join(tools.path, 'bin');
            mkdirSync(bin);
            await Bun.write(join(bin, 'govulncheck'), SCANNER);
            chmodSync(join(bin, 'govulncheck'), RUNS);
            commitAll(fixture.path);
            const environment = { PATH: `${bin}:${toolsPath(['golangci-lint', 'typos', 'ec'])}` };
            await install(fixture.path, INIT, environment);
            // The scanner reports on every run, so init holds the finding; without its baseline it is a finding again.
            const held = run(fixture.path, ['check', 'go/govulncheck', '--no-cache'], environment);
            expect(held.code, held.stdout + held.stderr).toBe(0);
            rmSync(join(fixture.path, '.gspot/baselines/go.govulncheck.GO-2021-0113.json'));
            const outcome = run(fixture.path, ['check', 'go/govulncheck', '--no-cache'], environment);
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            expect(outcome.stdout).toContain('golang.org/x/text@v0.3.0 holds GO-2021-0113');
            expect(outcome.stdout).toContain('Fixed in golang.org/x/text@v0.3.7');
        },
        PLANTED_TIMEOUT_MS * 3,
    );
});
