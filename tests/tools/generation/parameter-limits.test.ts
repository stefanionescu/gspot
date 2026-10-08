import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { hasToolBuild } from '#tests/harness/platforms.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/apply.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { runTestCommandBlocking } from '#tests/harness/command.ts';
import { PARAMETER_CASES } from '#tests/config/tools/generation/parameter-limits.ts';
import type { ParameterDiagnostic } from '#tests/types/tools/generation/parameter-limits.ts';

// SwiftLint ships no Windows build, which its tool pin records.
for (const scenario of PARAMETER_CASES.filter((entry) => entry.language !== 'swift' || hasToolBuild('swiftlint'))) {
    test.each([7, 8])(`${String(scenario.command[0])} counts declared parameters with maximum %i`, async (maximum) => {
        await using directory = await testdir();
        const { language } = scenario;
        const limits =
            maximum === 7
                ? ''
                : `[limits.${language}]\nfunction_parameters = ${String(maximum)}\n[reasons]\n"limits.${language}.function_parameters" = "The project API declares eight required parameters."\n`;
        await createFileTree(directory.path, {
            'gspot.toml': buildPolicy([language], { tables: limits, level: 'all' }),
            [scenario.file]: scenario.source,
        });
        const session = await openSession(directory.path);
        using log = openOwnership(directory.path);
        writeGeneratedFiles(session, log);
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
