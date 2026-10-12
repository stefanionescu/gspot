import { join } from 'node:path';
import { selectRuleFiles } from '#cli/rules.ts';
import { hookStatus } from '#cli/install/hooks.ts';
import { type Session } from '#cli/types/planning.ts';
import { openSession } from '#cli/commands/session.ts';
import { EXIT_FINDINGS } from '#cli/config/terminal.ts';
import { findRoot } from '#cli/repository/find-root.ts';
import { type Command } from '@commander-js/extra-typings';
import { readVersionPin } from '#cli/apply/version-pin.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { submodulePaths } from '#cli/repository/tracked.ts';
import { type CommandResult } from '#cli/types/terminal.ts';
import { colors, printResult } from '#cli/terminal/print.ts';
import { CI_FILE_LABELS } from '#cli/config/generation/ci.ts';
import { everyManifest } from '#cli/configurations/select.ts';
import type { ToolInspection } from '#cli/types/tools/find.ts';
import { inspectTool, isToolAvailable } from '#cli/tools/find.ts';
import { currentOperatingSystem } from '#cli/system/environment.ts';
import { reconcileConfigurations } from '#cli/commands/reconcile.ts';
import { listSuggestions } from '#cli/commands/doctor/suggestions.ts';
import { collectPins, missingBuild } from '#cli/configurations/tool-pins.ts';
import { type Suggestions, type DoctorReport } from '#cli/types/commands/doctor.ts';
import { VERSION_GAP, COLUMN_WIDTHS, TOOL_STATE_COLORS, SUGGESTION_SECTIONS } from '#cli/config/commands/doctor.ts';

function versionText(tool: ToolInspection): string {
    const found = tool.found ?? '';
    const want = tool.want ?? '';
    if (tool.state === 'outdated') return `${tool.name} ${found} (below ${tool.floor ?? want})`;
    if (tool.state === 'newer') return `${tool.name} ${found} (pinned ${want})`;
    return `${tool.name} ${want === '' ? found : want}`.trim();
}

function toolLines(tools: ToolInspection[]): string[] {
    const width = Math.max(...tools.map((tool) => versionText(tool).length)) + VERSION_GAP;
    return tools.map((tool) => {
        const isBroken = !isToolAvailable(tool);
        const tail = isBroken ? [tool.note, tool.hint].filter((part) => part !== undefined).join(' ') : tool.path;
        const label = colors[TOOL_STATE_COLORS[tool.state]](tool.state.padEnd(COLUMN_WIDTHS.label));
        return `  ${label} ${versionText(tool).padEnd(width)} ${tail}`.trimEnd();
    });
}

function suggestionLines(suggestions: Suggestions): string[] {
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

function versionLine(report: DoctorReport): string {
    const { running, pinned } = report.version;
    const runningText = pinned === running ? 'running' : `running ${running}`;
    const pin = pinned === undefined ? `${running} running, no pin` : `${pinned} pinned and ${runningText}`;
    return `gspot      ${pin}`;
}

/**
 * Builds the report: tool inspections and setup suggestions, hooks, CI, rules, and versions.
 * @param session the session
 * @param pinned the version `.gspot/version` pins, if any
 * @returns the report, with exit code 1 when tools or Git hooks need changes
 */
function buildDoctorReport(session: Session, pinned: string | undefined): DoctorReport {
    const platform = currentOperatingSystem();
    // The session omits a tool with no build for this host; its checks skip here.
    const inspections = new Map<string, ToolInspection>();
    const pins = collectPins(session.neededToolManifests).filter(
        (tool) => missingBuild(tool, platform, process.arch) === undefined,
    );
    for (const { scope, selected } of session.scopes) {
        const declared = new Set(selected.flatMap((manifest) => manifest.tools).map((tool) => tool.name));
        for (const tool of pins.filter((pin) => declared.has(pin.name))) {
            const inspection = inspectTool({ ...session, cwd: join(session.root, scope.path) }, tool);
            inspections.set(JSON.stringify(inspection), inspection);
        }
    }
    const tools = [...inspections.values()].toSorted((left, right) => left.name.localeCompare(right.name));
    const { settings } = session.settingsFile;
    const hooks = hookStatus({
        settings: session.settingsFile.settings,
        repository: session.repository,
        runner: session.startRunner,
    });
    const isBroken = [!hooks.ready, tools.some((tool) => !isToolAvailable(tool))].includes(true);
    return {
        submodules: submodulePaths(session.repository.index),
        tools,
        suggestions: listSuggestions(session),
        hooks: hooks.text,
        ci: settings.ci?.enabled === true ? CI_FILE_LABELS[settings.ci.provider] : 'none',
        ruleFiles: settings.rules.enabled
            ? selectRuleFiles(
                  settings.rules,
                  everyManifest(session.scopes),
                  session.repository,
                  settings.level,
                  session.packageManifests,
              ).length
            : 0,
        version: {
            running: session.version,
            ...(pinned === undefined ? {} : { pinned }),
        },
        exitCode: isBroken ? EXIT_FINDINGS : 0,
    };
}

/**
 * The report as text: one line per tool, then suggestions, hooks, CI, rules, and versions.
 * @param report the report
 * @returns the text for stdout
 */
function formatDoctorReport(report: DoctorReport): string {
    const lines = [
        'tools',
        ...toolLines(report.tools),
        '',
        ...suggestionLines(report.suggestions),
        `hooks      ${report.hooks}`,
        ...report.submodules.map((path) => `submodule  ${path} (contents are not read)`),
        `ci         ${report.ci}`,
        `rules      ${String(report.ruleFiles)} files`,
        versionLine(report),
    ];
    return `${lines.join('\n')}\n`;
}

/**
 * Reports configuration and tool errors.
 * @param directory the working directory
 * @returns the command result
 */
export async function doctorCommand(directory: string): Promise<CommandResult> {
    const root = findRoot(directory);
    const session = await openSession(root);
    const report = buildDoctorReport(session, readVersionPin(root));
    const stale = reconcileConfigurations(session).notes;
    const note =
        stale.length === 0 ? '' : `gspot apply would change gspot.toml: ${stale.join('; ')}. Run gspot apply.\n`;
    return {
        text: `${formatDoctorReport(report)}${note}`,
        json: { ...report, stale },
        exitCode: report.exitCode,
    };
}

/**
 * Register the doctor command.
 * @param program the command program
 */
export function registerDoctor(program: Command): void {
    program
        .command('doctor')
        .summary(COMMAND_HELP.doctor.summary)
        .description(COMMAND_HELP.doctor.description)
        .action(async () => {
            printResult(await doctorCommand(process.cwd()));
        });
}
