import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/planning/session.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { captureRejection } from '#tests/setup/matchers.ts';
import { planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { EMPTY_DEFAULT_SOURCE } from '#tests/config/typescript.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { runCheckCode, buildCheckSession } from '#cli/commands/check/run.ts';
import { checkGeneratorOutputs } from '#cli/checks/cross-configuration/generator-outputs.ts';

import {
    PROJECT_NOTES,
    GENERATOR_CASES,
    UNTRACKED_NOTES,
} from '#tests/config/checks/cross-configuration/generator-outputs.ts';

async function prepareGeneratorCheck(root: string, scenario: (typeof GENERATOR_CASES)[number]) {
    await createFileTree(root, {
        'gspot.toml': buildSandboxSettings([scenario.configuration], { tables: scenario.tables }),
        'package.json': '{"private":true}\n',
        'schema.txt': 'failure',
        'drizzle.config.ts': EMPTY_DEFAULT_SOURCE,
        'notes.txt': PROJECT_NOTES,
        [scenario.output]: 'original',
    });
    commitAll(root);
    await writeFile(join(root, scenario.output), 'dirty');
    await writeFile(join(root, 'untracked.txt'), UNTRACKED_NOTES);
    const session = await openSession(root);
    const input = planSandboxCheck(session, scenario.check);
    return {
        session,
        planned: {
            ...input,
            check: { ...input.check, command: buildProgramCommand('fakes/generator', scenario.output) },
        },
    };
}

test.each([...GENERATOR_CASES])(
    '$configuration generator reports a failed run and a stale file and leaves the files unchanged',
    async (row) => {
        await using sandbox = await testdir();
        const { session, planned } = await prepareGeneratorCheck(sandbox.path, row);
        const error = await captureRejection(
            runCheckCode(buildCheckSession(session), planned, { check: checkGeneratorOutputs }),
        );
        expect(error.message).toBe('The generator command failed: Generation failed\nfailure');
        await writeFile(join(sandbox.path, 'schema.txt'), 'changed');
        const stale = await runCheckCode(buildCheckSession(session), planned, { check: checkGeneratorOutputs });
        expect(stale.findings.map(({ check, file, rule }) => ({ check, file, rule }))).toStrictEqual([
            { check: row.check, file: row.output, rule: 'stale' },
        ]);
        await writeFile(join(sandbox.path, 'schema.txt'), 'dirty');
        const fresh = await runCheckCode(buildCheckSession(session), planned, { check: checkGeneratorOutputs });
        expect(fresh.findings).toStrictEqual([]);
        expect(await readFile(join(sandbox.path, row.output), 'utf8')).toBe('dirty');
        expect(await readFile(join(sandbox.path, 'notes.txt'), 'utf8')).toBe(PROJECT_NOTES);
        expect(await readFile(join(sandbox.path, 'untracked.txt'), 'utf8')).toBe(UNTRACKED_NOTES);
    },
);
