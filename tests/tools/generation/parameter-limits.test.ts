import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { hasToolBuild } from '#tests/harness/platforms.ts';
import { knownSettings } from '#cli/policy/settings/public.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { runTestCommandBlocking } from '#tests/harness/command.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { PARAMETER_CASES } from '#tests/config/tools/generation/parameter-limits.ts';
import type { ParameterDiagnostic } from '#tests/types/tools/generation/parameter-limits.ts';

const { value: defaultMaximum } = knownSettings([configurationManifests().get('structure')!], 'all').defaults.get(
    'limits.function_parameters',
)!;

// SwiftLint ships no Windows build, which its tool pin records.
for (const scenario of PARAMETER_CASES.filter((entry) => entry.language !== 'swift' || hasToolBuild('swiftlint'))) {
    test.each([defaultMaximum, 8])(
        `${String(scenario.command[0])} counts declared parameters with maximum %i`,
        async (maximum) => {
            await using directory = await testdir();
            const { language } = scenario;
            const limits =
                maximum === defaultMaximum
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
            expect(result.code, result.stdout + result.stderr).toBe(
                maximum === defaultMaximum ? scenario.failureStatus : 0,
            );
            expect(
                findings.filter(
                    (finding) => finding.code === 'PLR0913' || finding.rule_id === 'function_parameter_count',
                ),
            ).toMatchObject(maximum === defaultMaximum ? [scenario.finding] : []);
        },
    );
}
