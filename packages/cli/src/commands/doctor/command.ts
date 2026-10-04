import { resolve } from 'node:path';
import { collectPins } from '#cli/tools/pins.ts';
import { findRoot } from '#cli/repository/root.ts';
import { inspectTool } from '#cli/tools/inspect.ts';
import { openSession } from '#cli/execution/session.ts';
import { selectRuleFiles } from '#cli/rules/assemble.ts';
import type { CommandResult } from '#cli/types/output.ts';
import { hookStatus } from '#cli/lifecycle/hooks-path.ts';
import type { Program } from '#cli/types/commands/program.ts';
import { colors, printResult } from '#cli/output/messages.ts';
import { everyManifest } from '#cli/configurations/select.ts';
import type { Session } from '#cli/types/execution/session.ts';
import { readVersionPin } from '#cli/lifecycle/version-pin.ts';
import { EXIT_FINDINGS } from '#cli/config/platform/runtime.ts';
import { missingBuild } from '#cli/execution/planning/skips.ts';
import type { ToolInspection } from '#cli/types/tools/install.ts';
import { PLATFORM_NAMES } from '#cli/config/execution/planning.ts';
import { getSuggestions } from '#cli/commands/doctor/suggestions.ts';
import { reconcileConfigurations } from '#cli/lifecycle/reconcile.ts';
import { applicableManifests } from '#cli/execution/planning/requirements.ts';
import type { Suggestions, DoctorReport } from '#cli/types/commands/doctor.ts';
import { GITHUB_WORKFLOW, GITLAB_WORKFLOW } from '#cli/config/generation/ci.ts';
import { readIndexEntries, getSubmodulePaths } from '#cli/repository/tracked.ts';
import { VERSION_GAP, COLUMN_WIDTHS, TOOL_STATE_COLORS, SUGGESTION_SECTIONS } from '#cli/config/commands/doctor.ts';

function versionText(tool: ToolInspection): string {
    const found = tool.found ?? '';
    const want = tool.want ?? '';
    if (tool.state === 'outdated') return `${tool.name} ${found} (want ${want})`;
    if (tool.state === 'newer') return `${tool.name} ${found} (pinned ${want})`;
    return `${tool.name} ${want === '' ? found : want}`.trim();
}

function toolLines(tools: ToolInspection[]): string[] {
    const width = Math.max(...tools.map((tool) => versionText(tool).length)) + VERSION_GAP;
    return tools.map((tool) => {
        const isBroken = tool.state !== 'ok' && tool.state !== 'host';
        const tail = isBroken
            ? [tool.note, tool.hint].filter((part) => part !== undefined).join(' ')
            : (tool.path ?? '');
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
    const pinned = suggestions.duplicateMisePins.map((entry) => {
        const name = `${entry.tool} ${entry.version}`.padEnd(COLUMN_WIDTHS.name);
        return `  ${name} ${entry.places.join(' and ').padEnd(COLUMN_WIDTHS.path)} ${entry.command}`;
    });
    return [...sections.flat(), ...(pinned.length === 0 ? [] : ['pinned twice', ...pinned, ''])];
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
 * @returns the report, with exit code 1 when tools or hook integration need correction
 */
function buildDoctorReport(session: Session, pinned: string | undefined): DoctorReport {
    const platform = PLATFORM_NAMES[process.platform] ?? process.platform;
    // A tool with no build for this host is left out: the checks that need it skip here.
    const tools = collectPins(applicableManifests(session))
        .filter((tool) => missingBuild(tool, platform, process.arch) === undefined)
        .map((tool) => inspectTool(session, tool));
    const { policy } = session.policyFiles;
    const hooks = hookStatus({ policy: session.policyFiles.policy, repository: session.repository });
    const isBroken = !hooks.ready || tools.some((tool) => tool.state !== 'ok' && tool.state !== 'host');
    let ci = 'none';
    if (policy.ci !== undefined)
        ci = policy.ci.provider === 'github' ? GITHUB_WORKFLOW : `${GITLAB_WORKFLOW} (include from .gitlab-ci.yml)`;
    return {
        submodules: getSubmodulePaths(readIndexEntries(session.root)),
        tools,
        suggestions: getSuggestions(session),
        hooks: hooks.text,
        ci,
        rules: {
            files: policy.agentRules.enabled
                ? selectRuleFiles(policy.agentRules, everyManifest(session.scopes), session.repository, policy.level)
                      .length
                : 0,
        },
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
        `rules      ${String(report.rules.files)} files`,
        versionLine(report),
    ];
    return `${lines.join('\n')}\n`;
}

/**
 * Reports configuration and tool problems.
 * @param directory the working directory
 * @returns the command result
 */
export async function doctorCommand(directory: string): Promise<CommandResult> {
    const root = findRoot(directory);
    const session = await openSession(root);
    const report = buildDoctorReport(session, readVersionPin(root));
    const stale = reconcileConfigurations(session).notes;
    return {
        text: `${formatDoctorReport(report)}${stale.length === 0 ? '' : 'The saved setup is stale: ' + stale.join('; ') + '. Run: gspot apply\n'}`,
        json: { ...report, stale },
        exitCode: report.exitCode,
    };
}

/**
 * Registers doctor.
 * @param program the commander program
 */
export function registerDoctor(program: Program): void {
    program
        .command('doctor')
        .summary('Check the gspot setup')
        .description(
            'Report tools, Git hooks, setup suggestions, existing lint jobs, duplicate tool pins, and submodules. Detect stale configuration choices. doctor repairs nothing. Each problem includes the command to correct it.',
        )
        .addHelpText(
            'after',
            '\nExit codes:\n- 0: the selected tools and hooks are ready.\n- 1: a selected tool is missing, invalid, newer, or outdated, or a hook is not ready.\n- 2: doctor could not finish.\n\nExample:\ngspot doctor',
        )
        .action(async (_flags, command) => {
            const global = command.optsWithGlobals();
            const cwd = resolve(global.C ?? process.cwd());
            printResult(await doctorCommand(cwd));
        });
}
