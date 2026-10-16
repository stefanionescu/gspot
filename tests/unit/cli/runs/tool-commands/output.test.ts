import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { planRun } from '#cli/planning/checks.ts';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { TYPO } from '#tests/data/checks/spelling.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { TYPO_REPORT } from '#tests/data/tool-output.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { runCheckCommand } from '#cli/checks/run/command/check.ts';
import { type CheckDeclaration } from '#cli/types/configurations.ts';
import { hasToolError, formatOutputTail, parseCommandFindings } from '#cli/checks/run/command/output.ts';

import {
    REAL_PATH,
    BASE_CHECK,
    FAILED_RUN,
    FALSE_PATH,
    ESLINT_TOOL,
    ESLINT_CRASH,
    LOCATED_CHECK,
    HEADER_FAILURE,
    FILELESS_CHECKS,
} from '#tests/data/runs/command-checks.ts';

test('bounded failure output retains the final diagnostic from both streams', () => {
    const progress = Array.from({ length: 30 }, (_, index) => `progress ${String(index)}`).join('\n');
    const detail = formatOutputTail(
        {
            stdout: `${progress}\nstdout failure`,
            stderr: `${progress}\nstderr failure`,
        },
        'empty',
    );
    expect(detail).toContain('stdout failure');
    expect(detail).toContain('stderr failure');
    expect(detail).not.toContain('progress 0\n');
    expect(detail.length).toBeLessThan(`${progress}\nstdout failure\n${progress}\nstderr failure`.length);
});

test("a tool's crash pattern detects crashes for every check that runs it", () => {
    expect(
        hasToolError(
            { ...BASE_CHECK, output: { format: 'lines', file_type: 'path' }, command: [...BASE_CHECK.command] },
            ESLINT_TOOL,
            ESLINT_CRASH,
        ),
    ).toBe(true);
    expect(
        hasToolError(
            { ...BASE_CHECK, output: { format: 'lines', file_type: 'path' }, command: [...BASE_CHECK.command] },
            ESLINT_TOOL,
            { ...ESLINT_CRASH, stderr: '1 problem\n' },
        ),
    ).toBe(false);
    expect(
        hasToolError(
            { ...BASE_CHECK, output: { format: 'lines', file_type: 'path' }, command: [...BASE_CHECK.command] },
            undefined,
            ESLINT_CRASH,
        ),
    ).toBe(false);
});

test("a check's own pattern comes before the tool's", () => {
    const check = {
        ...BASE_CHECK,
        output: { format: 'lines', file_type: 'path' },
        command: [...BASE_CHECK.command],
        crash_pattern: '^Fatal:',
    } satisfies CheckDeclaration;
    expect(hasToolError(check, ESLINT_TOOL, ESLINT_CRASH)).toBe(false);
    expect(hasToolError(check, ESLINT_TOOL, { ...ESLINT_CRASH, stderr: 'Fatal: cannot write\n' })).toBe(true);
});

test('located output rejects false paths and empty failures while keeping mixed real findings', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'source.txt': 'source',
    });
    // Any manifest turns on the real-file check.
    const planned = {
        check: { ...LOCATED_CHECK, command: [...LOCATED_CHECK.command] },
        manifest: readManifests(createReadCache(process.cwd())).get('files')!,
        tool: { name: 'tool', installers: {}, kind: 'program' as const },
    };
    const paths = { cwd: sandbox.path, root: sandbox.path };
    expect(parseCommandFindings(planned, { ...FAILED_RUN, stdout: FALSE_PATH }, paths).note).toContain(
        'tool broke: exit 1',
    );
    expect(parseCommandFindings(planned, FAILED_RUN, paths).note).toContain('tool broke: exit 1');
    expect(
        parseCommandFindings(planned, { ...FAILED_RUN, stdout: FALSE_PATH + REAL_PATH }, paths).findings,
    ).toStrictEqual([
        { check: LOCATED_CHECK.name, file: '2026-09-19T02', message: 'FATAL', help: '', fixable: false },
        { check: LOCATED_CHECK.name, file: 'source.txt', message: 'located defect', help: '', fixable: false },
    ]);
    expect(parseCommandFindings(planned, { ...FAILED_RUN, code: 0 }, paths).findings).toStrictEqual([]);
    expect(await Bun.file(join(sandbox.path, 'source.txt')).text()).toBe('source');
});

test.each([...FILELESS_CHECKS])('$name accepts a fileless result without classifying it as a crash', async (check) => {
    await using sandbox = await testdir();
    // Any manifest turns on the real-file check.
    const planned = {
        check: { ...check, command: [...check.command] },
        manifest: readManifests(createReadCache(process.cwd())).get('files')!,
    };
    expect(parseCommandFindings(planned, FAILED_RUN, { cwd: sandbox.path, root: sandbox.path }).findings).toStrictEqual(
        [],
    );
});

test('spelling tells typos findings from fatal exits', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['spelling']),
        'sample.txt': `${TYPO.the}\n`,
    });
    const session = await openSession(sandbox.path);
    const plans = planRun(session, { stage: 'all', only: ['spelling/typos'] });
    const planned = plans[0]!;
    const stdout = JSON.stringify(TYPO_REPORT);
    const result = { stdout, stderr: '', code: 2, missing: false, duration: 1 };
    expect(parseCommandFindings(planned, result, { cwd: sandbox.path, root: sandbox.path }).findings).toMatchObject([
        { file: 'sample.txt' },
    ]);
    expect(
        parseCommandFindings(
            planned,
            { ...result, code: 78, stderr: 'Invalid native configuration.' },
            { cwd: sandbox.path, root: sandbox.path },
        ).note,
    ).toBeDefined();
    expect(
        parseCommandFindings(planned, { ...result, stdout: '' }, { cwd: sandbox.path, root: sandbox.path }).note,
    ).toBeDefined();
    expect(
        parseCommandFindings(planned, { ...result, stdout: '', code: 0 }, { cwd: sandbox.path, root: sandbox.path })
            .findings,
    ).toStrictEqual([]);
});

test('source text naming module errors stays an ESLint finding', async () => {
    await using sandbox = await testdir();
    const path = 'source.ts';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['typescript'], { level: 'all' }),
        [path]: 'const message = "ERR_MODULE_NOT_FOUND";\n',
    });
    const session = await openSession(sandbox.path);
    const plans = planRun(session, { stage: 'all', only: ['javascript/eslint'] });
    const planned = plans[0]!;
    const stdout = JSON.stringify([
        {
            filePath: join(sandbox.path, path),
            source: 'const message = "ERR_MODULE_NOT_FOUND"; // ConfigError:',
            messages: [{ ruleId: 'no-unused-vars', severity: 2, message: 'Unused message.', line: 1, column: 7 }],
        },
    ]);
    const result = { stdout, stderr: '', code: 1, missing: false, duration: 1 };
    expect(parseCommandFindings(planned, result, { cwd: sandbox.path, root: sandbox.path }).findings).toMatchObject([
        { file: path, rule: 'no-unused-vars', line: 1, column: 7 },
    ]);
    expect(
        parseCommandFindings(
            planned,
            { ...result, code: 2, stderr: 'ConfigError: invalid configuration' },
            { cwd: sandbox.path, root: sandbox.path },
        ).note,
    ).toBeDefined();
    expect(
        parseCommandFindings(
            planned,
            { ...result, stdout: '', code: 2, stderr: 'Oops! Something went wrong!\nERR_MODULE_NOT_FOUND: plugin' },
            { cwd: sandbox.path, root: sandbox.path },
        ).note,
    ).toContain('ERR_MODULE_NOT_FOUND: plugin');
});

test.each(['{file}', '{files}'])(
    'declared exit codes tell partial findings from a fatal %s run',
    async (placeholder) => {
        await using sandbox = await testdir();
        const source = 'input.txt';
        await createFileTree(sandbox.path, {
            'gspot.toml': stringify({
                configurations: [],
                command_check: [
                    {
                        name: 'project/exit-contract',
                        command: [process.execPath, 'checker.cjs', placeholder],
                        paths: [source],
                        stage: 'commit',
                        exit_codes: [1],
                        output: {
                            format: 'regex',
                            file_type: 'path',
                            pattern: String.raw`^(?<file>.+):(?<line>\d+): (?<message>.+)$`,
                        },
                    },
                ],
            }),
            [source]: '1',
            'checker.cjs':
                'const fs = require("node:fs"); const file = process.argv[2]; const status = Number(fs.readFileSync(file, "utf8")); if (status !== 0) console.log(`${file}:1: Located defect before exit`); process.exitCode = status;',
        });
        const session = await openSession(sandbox.path);
        const plans = planRun(session, { stage: 'all', only: ['project/exit-contract'] });
        const planned = plans[0]!;
        planned.tool = { name: process.execPath, installers: {}, kind: 'program' };
        const finding = await runCheckCommand(session, planned);
        expect(finding.status).toBe('failed');
        expect(finding.findings).toStrictEqual([
            matchFields({ file: source, line: 1, message: 'Located defect before exit' }),
        ]);
        await writeFile(join(sandbox.path, source), '7');
        const fatal = await runCheckCommand(session, planned);
        expect(fatal.status).toBe('error');
        expect(fatal.findings).toStrictEqual([]);
        expect(fatal.note).toContain('exit 7');
        expect(await Bun.file(join(sandbox.path, source)).text()).toBe('7');
    },
);

test('per-file failures drop only the header lines the tool declares', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText([], {
            tables: `[[command_check]]\nname = "project/native"\nstage = "commit"\npaths = ["source.txt"]\ncommand = ${JSON.stringify([process.execPath, '-e', HEADER_FAILURE, '{file}'])}\n`,
        }),
        'source.txt': 'source\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planRun(session, { stage: 'commit', only: ['project/native'] })[0]!;
    const unfiltered = await runCheckCommand(session, planned);
    expect(unfiltered.status).toBe('failed');
    expect(unfiltered.findings).toMatchObject([{ file: 'source.txt', message: 'Banner: scanner 1' }]);
    const filtered = await runCheckCommand(session, {
        ...planned,
        tool: { ...planned.tool!, finding_header_pattern: '^Banner:' },
    });
    expect(filtered.status).toBe('failed');
    expect(filtered.findings).toMatchObject([{ file: 'source.txt', message: 'Native input failed.' }]);
});

test('located output refuses a missing file and reports it once it exists', async () => {
    await using sandbox = await testdir();
    const source = 'unchanged input\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText([], {
            tables: String.raw`[[command_check]]
name = "notes/regex"
command = ${JSON.stringify([process.execPath, '-e', ''])}
paths = ["notes/**"]
stage = "commit"
[command_check.output]
format = "regex"
pattern = '^(?<file>[^:]+):(?<line>\d+):(?<message>.*)$'
`,
        }),
        'notes/selected.txt': source,
    });
    const session = await openSession(sandbox.path);
    const planned = planRun(session, { stage: 'all', only: ['notes/regex'] })[0]!;
    const configured = { ...planned, manifest: readManifests(createReadCache(process.cwd())).get('files')! };
    const result = { code: 1, stdout: 'notes/reported.txt:1:A defect.', stderr: '', missing: false, duration: 1 };
    const paths = { root: sandbox.path, cwd: sandbox.path };
    const expected = [{ check: 'notes/regex', file: 'notes/reported.txt', line: 1, message: 'A defect.' }];
    expect(planned.manifest).toBeUndefined();
    expect(parseCommandFindings(planned, result, paths).note).toBeDefined();
    expect(parseCommandFindings(configured, result, paths).note).toBeDefined();
    await Bun.write(join(sandbox.path, 'notes/reported.txt'), source);
    expect(parseCommandFindings(planned, result, paths).findings).toMatchObject(expected);
    expect(parseCommandFindings(configured, result, paths).findings).toMatchObject(expected);
    expect(parseCommandFindings(planned, result, paths).findings).toStrictEqual(
        parseCommandFindings(configured, result, paths).findings,
    );
    expect(await Bun.file(join(sandbox.path, 'notes/selected.txt')).text()).toBe(source);
    expect(await Bun.file(join(sandbox.path, 'notes/reported.txt')).text()).toBe(source);
});
