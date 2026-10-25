import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/setup/system/git.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { findCheckCode } from '#cli/checks/registry.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { GENERATOR_CASES } from '#tests/config/checks/generator-outputs.ts';
import { runCheckCode, buildCheckSession } from '#cli/commands/check/run.ts';

async function prepareGeneratorCheck(root: string, row: (typeof GENERATOR_CASES)[number]) {
    await createFileTree(root, {
        'gspot.toml': buildSandboxSettings([row.configuration], { tables: row.tables }),
        'package.json': '{"private":true}\n',
        'schema.txt': 'failure',
        'drizzle.config.ts': 'export default {};\n',
        'notes.txt': 'Keep project notes\n',
        [row.output]: 'original',
    });
    commitAll(root);
    await writeFile(join(root, row.output), 'dirty');
    await writeFile(join(root, 'untracked.txt'), 'Keep untracked notes\n');
    const session = await openSession(root);
    const input = planSandboxCheck(session, row.check);
    return {
        session,
        planned: { ...input, check: { ...input.check, command: buildProgramCommand('fakes/generator', row.output) } },
    };
}

test.each([...GENERATOR_CASES])(
    '$configuration generator reports a failed run and a stale file and leaves the files unchanged',
    async (row) => {
        await using sandbox = await testdir();
        const { session, planned } = await prepareGeneratorCheck(sandbox.path, row);
        const error = await captureRejection(
            runCheckCode(buildCheckSession(session), planned, findCheckCode(planned.check)),
        );
        expect(error.message).toBe('The generator command failed: Generation failed\nfailure');
        await writeFile(join(sandbox.path, 'schema.txt'), 'changed');
        const stale = await runCheckCode(buildCheckSession(session), planned, findCheckCode(planned.check));
        expect(stale.findings.map(({ check, file, rule }) => ({ check, file, rule }))).toStrictEqual([
            { check: row.check, file: row.output, rule: 'stale' },
        ]);
        await writeFile(join(sandbox.path, 'schema.txt'), 'dirty');
        const fresh = await runCheckCode(buildCheckSession(session), planned, findCheckCode(planned.check));
        expect(fresh.findings).toStrictEqual([]);
        expect(await readFile(join(sandbox.path, row.output), 'utf8')).toBe('dirty');
        expect(await readFile(join(sandbox.path, 'notes.txt'), 'utf8')).toBe('Keep project notes\n');
        expect(await readFile(join(sandbox.path, 'untracked.txt'), 'utf8')).toBe('Keep untracked notes\n');
    },
);
