import { runGspot } from '#tests/harness/gspot.ts';
import { markExecutable } from '#tests/harness/git.ts';
import { containing } from '#tests/harness/expectations.ts';
import { runFindingCase } from '#tests/harness/check-case.ts';
import { createTestRepository } from '#tests/harness/repository.ts';
import * as nextjs from '#tests/config/cli/checks/framework/nextjs.ts';
import { COMPONENT_SOURCE } from '#tests/config/samples/components.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import type { CaseChanges } from '#tests/types/harness/preservation.ts';
import type { FindingScenario } from '#tests/types/cli/checks/cases.ts';
import { BASH_CASES, TOOL_CHECKS } from '#tests/config/samples/bash.ts';
import * as siteOutput from '#tests/config/cli/checks/general/site/output.ts';
import type { OwnedTestRepository } from '#tests/types/harness/repository.ts';
import * as xctestSource from '#tests/config/cli/checks/tool/xctest/source.ts';
import * as bashStructure from '#tests/config/cli/checks/language/bash/structure.ts';
import * as libraryConventions from '#tests/config/cli/checks/library/conventions.ts';
import * as pythonStructure from '#tests/config/cli/checks/language/python/structure.ts';
import * as supabaseSettings from '#tests/config/cli/checks/platform/supabase/settings.ts';
import * as dependencyPolicy from '#tests/config/cli/checks/general/dependencies/policy.ts';
import * as structureFindings from '#tests/config/cli/checks/general/structure/findings.ts';
import * as cloudflareConfiguration from '#tests/config/cli/checks/platform/cloudflare/configuration.ts';

// What a check accepts beside the clean scripts: a guarded settings file and the environment owner.
const CORRECTIONS: Record<string, (repository: Pick<CaseChanges, 'files'>) => Record<string, string>> = {
    'bash/guards': () => ({
        'scripts/settings.sh':
            '#!/usr/bin/env bash\n[[ -n ${SETTINGS_READY:-} ]] && return 0\nreadonly SETTINGS_READY=1\nreadonly PORT=8080\n',
    }),
    'bash/env-owner': (repository) => ({ 'scripts/environment.sh': repository.files['scripts/environment.sh']! }),
};

for (const scenario of [
    { name: 'the built-in nextjs checks', repository: nextjs.REPOSITORY, cases: nextjs.CASES },
    { name: 'the dependencies configuration', repository: dependencyPolicy.REPOSITORY, cases: dependencyPolicy.CASES },
    {
        name: 'the structure configuration',
        repository: structureFindings.REPOSITORY,
        cases: structureFindings.CASES,
    },
    {
        name: 'the cloudflare configuration',
        repository: cloudflareConfiguration.REPOSITORY,
        cases: cloudflareConfiguration.CASES,
    },
    { name: 'the built-in supabase checks', repository: supabaseSettings.REPOSITORY, cases: supabaseSettings.CASES },
    {
        name: 'the built-in library checks',
        repository: {
            ...libraryConventions.REPOSITORY,
            corrected: (entry) => ({
                files: Object.fromEntries(Object.keys(entry.files).map((path) => [path, COMPONENT_SOURCE])),
            }),
        },
        cases: libraryConventions.CASES,
    },
    {
        name: 'the Python structure checks',
        repository: {
            ...pythonStructure.REPOSITORY,
            corrected: (entry) => ({
                files: Object.fromEntries(
                    Object.keys(entry.files).map((path) => [path, pythonStructure.STRUCTURE_CLEAN]),
                ),
            }),
        },
        cases: pythonStructure.CASES,
    },
    {
        name: 'the built-in bash checks',
        repository: {
            ...bashStructure.REPOSITORY,
            prepare: async (root) => {
                await markExecutable(root, 'scripts/build.sh');
            },
            corrected: (entry) => ({
                files: {
                    ...Object.fromEntries(Object.keys(entry.files).map((path) => [path, bashStructure.CLEAN])),
                    ...CORRECTIONS[entry.check]?.(entry),
                },
            }),
        },
        cases: BASH_CASES.filter((entry) => !TOOL_CHECKS.includes(entry.check)),
    },
    { name: 'the xctest configuration', repository: xctestSource.REPOSITORY, cases: xctestSource.CASES },
    { name: 'the built-output site checks', repository: siteOutput.REPOSITORY, cases: siteOutput.CASES },
] satisfies FindingScenario[]) {
    describe(scenario.name, () => {
        const resources = new AsyncDisposableStack();
        let repository: OwnedTestRepository;
        beforeAll(async () => {
            repository = resources.use(await createTestRepository(scenario.repository, runGspot));
        });
        afterAll(async () => {
            await resources.disposeAsync();
        });
        for (const entry of scenario.cases) {
            const where = [entry.expected.rule, entry.expected.file].filter(Boolean).join(' in ');
            test(`${entry.check} reports ${where} and accepts the correction`, async () => {
                const { failed, passed } = await runFindingCase(repository, entry, scenario.repository);
                expect(failed.code, `${entry.check}: ${failed.stdout}${failed.stderr}`).toBe(1);
                expect(failed.report.checks).toMatchObject([{ check: entry.check, status: 'failed' }]);
                expect(failed.report.checks[0]?.findings).toContainEqual(
                    containing({ check: entry.check, ...entry.expected }),
                );
                expect(passed.code, `${entry.check} corrected: ${passed.stdout}${passed.stderr}`).toBe(0);
                expect(passed.report.checks).toMatchObject([{ check: entry.check, status: 'passed', findings: [] }]);
            });
        }
    });
}
