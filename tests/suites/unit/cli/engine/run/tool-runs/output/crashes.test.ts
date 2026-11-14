import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { BROKEN_TOOL_ADVICE } from '#cli/config/engine.ts';
import { getShippedCheck } from '#tests/setup/cli/manifests.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { parseCommandFindings } from '#cli/engine/run/tool-runs/output.ts';
import { BASE_CHECK, ASTRO_CHECK_OUTPUT, TYPE_ERROR_MESSAGE, ASTRO_CHECK_SUMMARY } from '#tests/config/engine/run.ts';

test('a crash note leads with the error output of the tool, and only --verbose adds its report', async () => {
    await using sandbox = await testdir();
    const check = { ...BASE_CHECK, needs: ['network' as const], exit_codes: [0] };
    const result = buildProcessResult({ code: 2, stdout: '{"Results":[]}', stderr: 'scan log\nrequest refused\n' });
    const paths = { cwd: sandbox.path, root: sandbox.path };
    expect(parseCommandFindings({ check }, result, paths, {}).note).toBe(
        `${check.id} failed with exit 2:\nscan log\nrequest refused`,
    );
    expect(parseCommandFindings({ check }, result, paths, { verbose: true }).note).toBe(
        `${check.id} failed with exit 2:\nscan log\nrequest refused\n{"Results":[]}`,
    );
    const silent = buildProcessResult({ code: 2, stdout: 'Unexpected token in package.json', stderr: '' });
    expect(parseCommandFindings({ check }, silent, paths, {}).note).toBe(
        `${check.id} failed with exit 2:\nUnexpected token in package.json`,
    );
});

test('astro check reads a TypeScript diagnostic from colored output, and its crash note holds no color codes', async () => {
    await using sandbox = await testdir({ 'src/env.ts': "export const count: number = 'three';\n" });
    const check = getShippedCheck('astro/astro-check');
    const paths = { cwd: sandbox.path, root: sandbox.path };
    const reported = parseCommandFindings(
        { check },
        buildProcessResult({ code: 1, stdout: ASTRO_CHECK_OUTPUT }),
        paths,
        {},
    );
    expect(reported.findings).toMatchObject([
        {
            file: 'src/env.ts',
            line: 1,
            column: 14,
            rule: 'ts(2322)',
            message: TYPE_ERROR_MESSAGE,
        },
    ]);
    const crashed = parseCommandFindings(
        { check },
        buildProcessResult({ code: 1, stdout: ASTRO_CHECK_SUMMARY }),
        paths,
        {},
    );
    expect(crashed).toStrictEqual({ note: 'astro/astro-check failed with exit 1:\nResult (1 file): \n- 1 error' });
});

test.each([
    { name: 'a module of a tool that fails to load', advice: true },
    { name: 'a tool that fails at run time', advice: false },
])('a crash note names gspot install only for $name', async ({ advice }) => {
    await using sandbox = await testdir();
    const check = { ...BASE_CHECK, exit_codes: [2] };
    const module = `file://${sandbox.path}/.gspot/node_modules/prettier/internal/cli.mjs:12`;
    const stderr = advice
        ? `${module}\nSyntaxError: The requested module '../index.mjs' does not provide an export named 'format'\n    at ModuleJob._instantiate (node:internal/modules/esm/module_job:180:21)\n`
        : `${module}\nTypeError: Cannot read properties of undefined\n    at run (${module}:4)\n`;
    const note = parseCommandFindings(
        { check },
        buildProcessResult({ code: 1, stderr }),
        { cwd: sandbox.path, root: sandbox.path },
        {},
    ).note;
    expect(note?.endsWith(`\n${BROKEN_TOOL_ADVICE}`)).toBe(advice);
});
