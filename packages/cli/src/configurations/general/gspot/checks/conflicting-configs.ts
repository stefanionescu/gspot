import { GSPOT_RULES } from '#cli/config/configurations/structure.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { LINT_COMMAND_NAMES } from '#cli/config/repository/setup.ts';
import { CONFLICTING_CONFIG_EXPLANATIONS } from '#cli/configurations/general/gspot/explanations.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { listConflictingConfigs } from '#cli/repository/conflicts.ts';
import { listGeneratedPaths } from '#cli/repository/files/classify.ts';
import { findLine, listLintCommands } from '#cli/repository/lint-commands.ts';
import { findText } from '#cli/system/files/reads.ts';
import { listReplacedTools } from '#cli/tools/pins.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckSession } from '#cli/types/engine/run.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';

/**
Reports each settings file of a tool that gspot writes settings for, such as .commitlintrc.json while commitlint runs,
and each lint command that calls a tool that gspot replaces.

@param session the repository and the tools that the selected checks run.
@param _planned the configured check and selected scope files.
*/
function checkConflictingConfigs(session: CheckSession, _planned: PlannedCheck): CheckFinding[] {
    const tools = new Set(
        session.toolConfigurations.flatMap((configuration) => configuration.tools.map((tool) => tool.name)),
    );
    const generated = listGeneratedPaths(session.repository.files);
    const conflicts = listConflictingConfigs(session.root, session.repository.files, readConfigurations().values())
        .filter(({ tool, path, pointer }) => tools.has(tool) && !generated.has(path) && pointer !== true)
        .map(({ tool, path, shared, table, key }) => ({
            file: path,
            line: table === undefined ? 1 : findLine(findText(session.root, path) ?? '', `[${table}`),
            rule: GSPOT_RULES.conflictingConfig,
            message: shared
                ? `gspot writes the settings for ${tool}, so ${table ?? key ?? tool} in ${path} no longer applies. Delete the section, and move any rule you need into gspot.toml.`
                : `gspot writes the settings for ${tool}, so ${path} no longer applies. Delete it, and move any rule you need into gspot.toml.`,
        }));
    const commands = listLintCommands({
        root: session.root,
        files: session.repository.files,
        ...listReplacedTools(session.toolConfigurations),
    }).map(({ file, line, source, command, tool, fix }) => ({
        file,
        line,
        rule: GSPOT_RULES.lintCommand,
        message: `${LINT_COMMAND_NAMES[source]} ${source === 'settings' ? 'configures' : 'calls'} ${tool}: ${command}. ${fix}`,
    }));
    const findings = [...conflicts, ...commands];
    const narrowed = session.selection?.paths;
    return narrowed === undefined || narrowed.includes(SETTINGS_FILE)
        ? findings
        : findings.filter(({ file }) => narrowed.includes(file));
}

export const GSPOT_CONFLICTING_CONFIGS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'gspot/conflicting-configs': { check: checkConflictingConfigs, explanations: CONFLICTING_CONFIG_EXPLANATIONS },
};
