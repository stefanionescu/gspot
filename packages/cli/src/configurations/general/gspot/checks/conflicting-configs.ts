import type { Session } from '#cli/types/tools.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { GSPOT_RULES } from '#cli/config/configurations/structure.ts';
import { listConflictingConfigs } from '#cli/repository/conflicts.ts';
import { listGeneratedPaths } from '#cli/repository/files/classify.ts';

/**
Reports each settings file of a tool that gspot writes settings for, such as .commitlintrc.json while commitlint runs.

@param session the repository and the tools that the selected checks run.
@param _planned the configured check and selected scope files.
*/
export function checkConflictingConfigs(session: Session, _planned: PlannedCheck): CheckFinding[] {
    const tools = new Set(
        session.toolConfigurations.flatMap((configuration) => configuration.tools.map((tool) => tool.name)),
    );
    const generated = listGeneratedPaths(session.repository.files);
    return listConflictingConfigs(session.root, session.repository.files, readConfigurations().values())
        .filter(({ tool, path, shared }) => !shared && tools.has(tool) && !generated.has(path))
        .map(({ tool, path }) => ({
            file: path,
            line: 1,
            rule: GSPOT_RULES.conflictingConfig,
            message: `gspot writes the settings for ${tool}, so ${path} no longer applies. Delete it, and move any rule you need into gspot.toml.`,
        }));
}
