import { buildFinding } from '#cli/runs/finding.ts';
import { type Session } from '#cli/types/session.ts';
import { buildBuiltInResult } from '#cli/runs/built-in.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { type CheckResult } from '#cli/types/runs/check.ts';
import { listGeneratedPaths } from '#cli/repository/files/classify.ts';
import { listConflictingConfigFiles } from '#cli/repository/existing/config-files.ts';

/**
 * Reports each settings file of a tool that gspot writes settings for, such as .commitlintrc.json while commitlint
 * runs. A level change or a new configuration can make gspot take over a tool after init ran.
 *
 * @param session the repository and the tools that the selected checks run.
 * @param planned the repository-wide check.
 * @returns the check result.
 */
export function checkConflictingConfigFiles(session: Session, planned: PlannedCheck): CheckResult {
    const started = performance.now();
    const tools = new Set(
        session.neededToolConfigurations.flatMap((configuration) => configuration.tools.map((tool) => tool.name)),
    );
    const generated = listGeneratedPaths(session.repository.files);
    const findings = listConflictingConfigFiles(session.root, session.repository.files, session.configurations.values())
        .filter(({ tool, path, shared }) => !shared && tools.has(tool) && !generated.has(path))
        .map(({ tool, path }) =>
            buildFinding(
                planned,
                { file: path, line: 1 },
                'conflicting-config-file',
                `gspot writes the settings for ${tool}, so ${path} no longer applies. Delete it, and move any rule you need into gspot.toml.`,
            ),
        );
    return buildBuiltInResult(planned, session, { result: findings, started });
}
