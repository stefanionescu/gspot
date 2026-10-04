import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { runTestCommandBlocking } from '#tests/harness/command.ts';
import { PARAMETER_CASES } from '#tests/config/tools/generation/parameter-limits.ts';
import type { ParameterDiagnostic } from '#tests/types/tools/generation/parameter-limits.ts';

// SwiftLint ships no Windows build, which its tool pin records.
for (const scenario of PARAMETER_CASES.filter((entry) => entry.language !== 'swift' || process.platform !== 'win32')) {
    test.each([7, 8])(`${scenario.language} counts declared parameters with maximum %i`, async (maximum) => {
        await using directory = await testdir();
        const { language, configName } = scenario;
        const limits = maximum === 7 ? '' : `[limits.${language}]\nfunction_parameters = ${String(maximum)}\n`;
        await createFileTree(directory.path, {
            'gspot.toml': buildPolicy([language], { tables: limits, level: 'all' }),
            [scenario.file]: scenario.source,
        });
        const session = await openSession(directory.path);
        const files = emitAll(session).files;
        const config = files.find(({ path }) => path === configName)!;
        mkdirSync(join(directory.path, '.gspot/config'), { recursive: true });
        writeFileSync(join(directory.path, configName), config.content);
        const result = runTestCommandBlocking(scenario.command, {
            cwd: directory.path,
        });
        const findings = JSON.parse(result.stdout) as ParameterDiagnostic[];
        expect(result.code, result.stdout + result.stderr).toBe(maximum === 7 ? scenario.failureStatus : 0);
        expect(
            findings.filter((finding) => finding.code === 'PLR0913' || finding.rule_id === 'function_parameter_count'),
        ).toMatchObject(maximum === 7 ? [scenario.finding] : []);
    });
}
