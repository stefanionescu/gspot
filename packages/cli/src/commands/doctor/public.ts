import { join, resolve } from 'node:path';
import { hostPlatform } from '#cli/platform/public.ts';
import { missingBuild } from '#cli/planning/contracts.ts';
import { readVersionPin } from '#cli/lifecycle/public.ts';
import type { CommandResult } from '#cli/types/terminal.ts';
import { selectRuleFiles } from '#cli/agent-rules/public.ts';
import type { Program } from '#cli/types/commands/program.ts';
import { applicableManifests } from '#cli/planning/public.ts';
import { colors, printResult } from '#cli/terminal/public.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import { collectPins } from '#cli/configurations/contracts.ts';
import { EXIT_FINDINGS } from '#cli/config/platform/runtime.ts';
import { getSubmodulePaths } from '#cli/repository/contracts.ts';
import { hookStatus } from '#cli/lifecycle/install/contracts.ts';
import type { ToolInspection } from '#cli/types/tools/install.ts';
import { findRoot } from '#cli/repository/discovery/contracts.ts';
import { commandHelp, openSession } from '#cli/commands/public.ts';
import { getSuggestions } from '#cli/commands/doctor/contracts.ts';
import { inspectTool, isToolAvailable } from '#cli/tools/public.ts';
import { everyManifest } from '#cli/configurations/selection/public.ts';
import type { Suggestions, DoctorReport } from '#cli/types/commands/doctor.ts';
import { reconcileConfigurations } from '#cli/lifecycle/selection/contracts.ts';

import {
    VERSION_GAP,
    COLUMN_WIDTHS,
    CI_REPORT_PATHS,
    TOOL_STATE_COLORS,
    SUGGESTION_SECTIONS,
} from '#cli/config/commands/doctor.ts';

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
function buildDoctorReport(session: ToolSession, pinned: string | undefined): DoctorReport {
    const platform = hostPlatform();
    // A tool with no build for this host is left out: the checks that need it skip here.
    const inspections = new Map<string, ToolInspection>();
    const pins = collectPins(applicableManifests(session)).filter(
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
    const { policy } = session.policyFiles;
    const hooks = hookStatus({ policy: session.policyFiles.policy, repository: session.repository });
    const isBroken = !hooks.ready || tools.some((tool) => !isToolAvailable(tool));
    return {
        submodules: getSubmodulePaths(session.repository.index),
        tools,
        suggestions: getSuggestions(session),
        hooks: hooks.text,
        ci: policy.ci === undefined ? 'none' : CI_REPORT_PATHS[policy.ci.provider],
        rules: {
            files: policy.agent_rules.enabled
                ? selectRuleFiles(policy.agent_rules, everyManifest(session.scopes), session.repository, policy.level)
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
 * Reports configuration and tool errors.
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
        .addHelpText('after', commandHelp('doctor'))
        .action(async (_flags, command) => {
            const global = command.optsWithGlobals();
            const cwd = resolve(global.C ?? process.cwd());
            printResult(await doctorCommand(cwd));
        });
}
