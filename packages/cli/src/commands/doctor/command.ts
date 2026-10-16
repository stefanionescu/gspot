import { join } from 'node:path';
import { openSession } from '#cli/session.ts';
import { colors } from '#cli/system/terminal.ts';
import { formatCount } from '#cli/system/text.ts';
import { findRoot } from '#cli/repository/read.ts';
import { inspectTool } from '#cli/tools/inspect.ts';
import { readHookStatus } from '#cli/apply/hooks.ts';
import { type Session } from '#cli/types/planning.ts';
import { EXIT_FINDINGS } from '#cli/config/terminal.ts';
import { type Command } from '@commander-js/extra-typings';
import { readVersionPin } from '#cli/apply/version-pin.ts';
import { selectRuleFiles } from '#cli/generation/rules.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { CI_FILE_LABELS } from '#cli/config/generation/ci.ts';
import { listSubmodulePaths } from '#cli/repository/tracked.ts';
import { getOperatingSystem } from '#cli/system/environment.ts';
import { AVAILABLE_TOOL_STATES } from '#cli/config/tools/find.ts';
import { listSuggestions } from '#cli/commands/doctor/suggestions.ts';
import { findMissingBuild, listDistinctTools } from '#cli/configurations/tools.ts';
import { type Suggestions, type DoctorReport } from '#cli/types/commands/doctor.ts';
import { type CommandResult, type CommandCompletion } from '#cli/types/terminal.ts';
import type { ToolInspection, AvailableToolInspection } from '#cli/types/tools/find.ts';
import { VERSION_GAP, COLUMN_WIDTHS, TOOL_STATE_COLORS, SUGGESTION_SECTIONS } from '#cli/config/commands/doctor.ts';

/**
 * Whether the inspected tool can run at a supported version.
 *
 * @param inspection the executable inspection.
 *
 * @returns whether inspection found a usable executable.
 */
function isToolAvailable(inspection: ToolInspection): inspection is AvailableToolInspection {
    return AVAILABLE_TOOL_STATES.has(inspection.state) && inspection.path !== undefined;
}

function formatToolVersion(tool: ToolInspection): string {
    const found = tool.found ?? '';
    const want = tool.want ?? '';
    if (tool.state === 'outdated') return `${tool.name} ${found} (below ${tool.floor ?? want})`;
    if (tool.state === 'newer') return `${tool.name} ${found} (pinned ${want})`;
    return `${tool.name} ${want === '' ? found : want}`.trim();
}

function formatTools(tools: ToolInspection[]): string[] {
    const width = Math.max(...tools.map((tool) => formatToolVersion(tool).length)) + VERSION_GAP;
    return tools.map((tool) => {
        const isBroken = !isToolAvailable(tool);
        const tail = isBroken ? [tool.note, tool.hint].filter((part) => part !== undefined).join(' ') : tool.path;
        const label = colors()[TOOL_STATE_COLORS[tool.state]](tool.state.padEnd(COLUMN_WIDTHS.label));
        return `  ${label} ${formatToolVersion(tool).padEnd(width)} ${tail}`.trimEnd();
    });
}

function formatSuggestions(suggestions: Suggestions): string[] {
    const sections = SUGGESTION_SECTIONS.map(({ key, title }) => {
        const rows = suggestions[key].map((entry) => {
            const name = ('configuration' in entry ? entry.configuration : entry.path).padEnd(COLUMN_WIDTHS.name);
            const detail = ('evidence' in entry ? entry.evidence : entry.note).padEnd(COLUMN_WIDTHS.note);
            return `  ${name} ${detail} ${entry.command}`;
        });
        return rows.length === 0 ? [] : [title, ...rows, ''];
    });
    return sections.flat();
}

function formatGspotVersion(report: DoctorReport): string {
    const { running, pinned } = report.version;
    const runningText = pinned === running ? 'running' : `running ${running}`;
    const pin = pinned === undefined ? `${running} running, no pin` : `${pinned} pinned and ${runningText}`;
    return `gspot      ${pin}`;
}

/**
 * Builds the report: tool inspections and setup suggestions, hooks, CI, rules, and versions.
 * @param session the configured scopes and tool declarations to inspect on the current host.
 * @param pinned the version `.gspot/version` pins, if any
 * @returns the report, with exit code 1 when tools or Git hooks need changes
 */
function buildDoctorReport(session: Session, pinned: string | undefined): DoctorReport {
    const platform = getOperatingSystem();
    // The session omits a tool with no build for this host; its checks skip here.
    const inspections = new Map<string, ToolInspection>();
    const pins = listDistinctTools(session.neededToolManifests).filter(
        (tool) => findMissingBuild(tool, platform, process.arch) === undefined,
    );
    for (const { scope, selected } of session.scopes) {
        const declared = new Set(selected.flatMap((manifest) => manifest.tools).map((tool) => tool.name));
        for (const tool of pins.filter((pin) => declared.has(pin.name))) {
            const inspection = inspectTool({ ...session, cwd: join(session.root, scope.path) }, tool);
            inspections.set(`${tool.name}\0${scope.path}`, inspection);
        }
    }
    const tools = [...inspections.values()].toSorted((left, right) => left.name.localeCompare(right.name));
    const { settings } = session.settingsFile;
    const hooks = readHookStatus({
        settings: session.settingsFile.settings,
        repository: session.repository,
        runner: session.startRunner,
    });
    const isBroken = [!hooks.ready, tools.some((tool) => !isToolAvailable(tool))].includes(true);
    return {
        submodules: listSubmodulePaths(session.repository.index),
        tools,
        suggestions: listSuggestions(session),
        hooks: hooks.text,
        ci: settings.ci?.enabled === true ? CI_FILE_LABELS[settings.ci.provider] : 'none',
        ruleFiles: selectRuleFiles(session).length,
        version: {
            running: session.version,
            ...(pinned === undefined ? {} : { pinned }),
        },
        exitCode: isBroken ? EXIT_FINDINGS : 0,
    };
}

/**
 * The report as text: one line per tool, then suggestions, hooks, CI, rules, and versions.
 * @param report the tool readiness, hooks, and configuration suggestions to print.
 * @returns the text for stdout
 */
function formatDoctorReport(report: DoctorReport): string {
    const lines = [
        ...formatTools(report.tools.filter((tool) => !isToolAvailable(tool))),
        `tools: ${String(report.tools.filter(isToolAvailable).length)} ready`,
        '',
        ...formatSuggestions(report.suggestions),
        `hooks: ${report.hooks.endsWith(': installed') ? 'installed' : report.hooks}`,
        ...report.submodules.map((path) => `submodule  ${path} (contents are not read)`),
        `ci: ${report.ci}`,
        `rules: ${formatCount(report.ruleFiles, 'file')}`,
        formatGspotVersion(report),
    ];
    return `${lines.join('\n')}\n`;
}

/**
 * Reports configuration and tool errors.
 * @param folder the folder where the command looks for the repository.
 * @returns the command result
 */
async function runDoctorCommand(folder: string): Promise<CommandResult> {
    const root = findRoot(folder);
    const session = await openSession(root);
    const report = buildDoctorReport(session, readVersionPin(root));
    return {
        text: formatDoctorReport(report),
        json: report,
        exitCode: report.exitCode,
    };
}

/**
 * Register the doctor command.
 * @param program the command program
 * @param onResult the sink that writes the completed command result.
 */
export function registerDoctor(program: Command, onResult: CommandCompletion): void {
    program
        .command('doctor')
        .summary(COMMAND_HELP.doctor.summary)
        .description(COMMAND_HELP.doctor.description)
        .action(async () => {
            onResult(await runDoctorCommand(process.cwd()));
        });
}
