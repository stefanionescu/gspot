import { join } from 'node:path';
import { openSession } from '#cli/session.ts';
import { findRoot } from '#cli/repository/read.ts';
import { getColors } from '#cli/system/terminal.ts';
import { inspectTool } from '#cli/tools/inspect.ts';
import type { Session } from '#cli/types/session.ts';
import { readHookStatus } from '#cli/install/hooks.ts';
import { getMiseBinPaths } from '#cli/tools/locate.ts';
import { EXIT_FINDINGS } from '#cli/config/terminal.ts';
import type { Command } from '@commander-js/extra-typings';
import { selectRuleFiles } from '#cli/generation/rules.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { compareText, formatCount } from '#cli/system/text.ts';
import { readVersionPin } from '#cli/repository/version-pin.ts';
import { getOperatingSystem } from '#cli/system/environment.ts';
import { AVAILABLE_TOOL_STATES } from '#cli/config/tools/inspect.ts';
import type { ToolInspection } from '#cli/types/tools/inspection.ts';
import { listSuggestions } from '#cli/commands/doctor/suggestions.ts';
import { listSubmodulePaths } from '#cli/repository/files/tracked.ts';
import type { Suggestions, DoctorReport } from '#cli/types/commands/doctor.ts';
import type { CommandResult, CommandCompletion } from '#cli/types/terminal.ts';
import { findMissingBuild, listDistinctTools } from '#cli/configurations/tools.ts';

import {
    VERSION_GAP,
    COLUMN_WIDTHS,
    CI_FILE_LABELS,
    TOOL_STATE_COLORS,
    SUGGESTION_SECTIONS,
} from '#cli/config/commands/doctor.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Callers narrow the type through it.
function isToolAvailable(inspection: ToolInspection): inspection is ToolInspection & { path: string } {
    return AVAILABLE_TOOL_STATES.has(inspection.state) && inspection.path !== undefined;
}

function formatToolVersion(tool: ToolInspection): string {
    const found = tool.found ?? '';
    const want = tool.want ?? '';
    if (tool.state === 'outdated') return `${tool.name} ${found} (below ${tool.minimumVersion ?? want})`;
    if (tool.state === 'newer') return `${tool.name} ${found} (pinned ${want})`;
    return `${tool.name} ${want === '' ? found : want}`.trim();
}

function formatTools(tools: ToolInspection[]): string[] {
    const width = Math.max(...tools.map((tool) => formatToolVersion(tool).length)) + VERSION_GAP;
    return tools.map((tool) => {
        const isBroken = !isToolAvailable(tool);
        const tail = isBroken ? [tool.note, tool.help].filter((text) => text !== undefined).join(' ') : tool.path;
        const label = getColors()[TOOL_STATE_COLORS[tool.state]](tool.state.padEnd(COLUMN_WIDTHS.label));
        return `  ${label} ${formatToolVersion(tool).padEnd(width)} ${tail}`.trimEnd();
    });
}

function formatSuggestions(suggestions: Suggestions): string[] {
    const sections = SUGGESTION_SECTIONS.map(({ key, title }) => {
        const cells = suggestions[key].map((suggestion) => ({
            name: 'configuration' in suggestion ? suggestion.configuration : suggestion.path,
            detail: 'evidence' in suggestion ? suggestion.evidence : suggestion.note,
            command: suggestion.command,
        }));
        const nameWidth = Math.max(COLUMN_WIDTHS.name, ...cells.map(({ name }) => name.length));
        const detailWidth = Math.max(COLUMN_WIDTHS.note, ...cells.map(({ detail }) => detail.length));
        const rows = cells.map(({ name, detail, command }) =>
            command === undefined
                ? `  ${name.padEnd(nameWidth)} ${detail}`
                : `  ${name.padEnd(nameWidth)} ${detail.padEnd(detailWidth)} ${command}`,
        );
        return rows.length === 0 ? [] : [title, ...rows, ''];
    });
    return sections.flat();
}

function formatGspotVersion(report: DoctorReport): string {
    const { running, pin } = report.version;
    const runningText = pin === running ? 'running' : `running ${running}`;
    const version = pin === undefined ? `${running} running, no pin` : `${pin} pinned and ${runningText}`;
    const install =
        report.version.installCommand === undefined
            ? ''
            : `\nInstall the pinned version: ${report.version.installCommand}`;
    return `gspot      ${version}${install}`;
}

function buildDoctorVersion(session: Session, pin: string | undefined): DoctorReport['version'] {
    const version: DoctorReport['version'] = {
        running: cliPackage.version,
        ...(pin !== undefined && { pin }),
    };
    if (pin !== undefined && pin !== cliPackage.version)
        version.installCommand = session.startRunner.installCommand.replace('<version>', () => pin);
    return version;
}

function buildDoctorReport(session: Session, versionPin: string | undefined): DoctorReport {
    const platform = getOperatingSystem();
    const inspections = new Map<string, ToolInspection>();
    const pins = listDistinctTools(session.toolConfigurations).filter(
        (tool) => findMissingBuild(tool, { platform, arch: process.arch }) === undefined,
    );
    for (const { folder, configurations } of session.scopes) {
        const toolNames = new Set(
            configurations.flatMap((configuration) => configuration.tools).map((tool) => tool.name),
        );
        for (const tool of pins) {
            if (!toolNames.has(tool.name)) continue;
            const inspection = inspectTool(
                { ...session, cwd: join(session.root, folder.path), miseBinPaths: getMiseBinPaths(session) },
                tool,
            );
            inspections.set(JSON.stringify(inspection), inspection);
        }
    }
    const tools = inspections
        .values()
        .toArray()
        .toSorted((left, right) => compareText(left.name, right.name));
    const { settings } = session.settingsFile;
    const hooks = readHookStatus(session, session.repository);
    const version = buildDoctorVersion(session, versionPin);
    const isBroken = [
        !hooks.ready,
        tools.some((tool) => !isToolAvailable(tool)),
        version.installCommand !== undefined,
    ].some(Boolean);
    return {
        submodules: listSubmodulePaths(session.repository.index),
        tools,
        suggestions: listSuggestions(session),
        hooks: hooks.text,
        ci: settings.ci?.enabled === true ? CI_FILE_LABELS[settings.ci.provider] : 'none',
        ruleFiles: selectRuleFiles(session).length,
        version,
        exitCode: isBroken ? EXIT_FINDINGS : 0,
    };
}

function formatDoctorReport(report: DoctorReport): string {
    const lines = [
        ...formatTools(report.tools.filter((tool) => !isToolAvailable(tool))),
        `tools: ${String(report.tools.filter(isToolAvailable).length)} ready`,
        '',
        ...formatSuggestions(report.suggestions),
        `hooks: ${report.hooks}`,
        ...report.submodules.map((path) => `submodule  ${path} (contents are not read)`),
        `ci: ${report.ci}`,
        `rules: ${formatCount(report.ruleFiles, 'file')}`,
        formatGspotVersion(report),
    ];
    return `${lines.join('\n')}\n`;
}

async function runDoctorCommand(cwd: string): Promise<CommandResult> {
    const root = findRoot(cwd);
    const session = await openSession(root);
    const report = buildDoctorReport(session, readVersionPin(root));
    return {
        text: formatDoctorReport(report),
        json: report,
        exitCode: report.exitCode,
    };
}

/**
Register the doctor command.

@param program the gspot program that gets the command.
@param onResult receives the result of the command.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: main.ts registers the command through it, like every other command.
export function registerDoctor(program: Command, onResult: CommandCompletion): void {
    program
        .command('doctor')
        .summary(COMMAND_HELP.doctor.summary)
        .description(COMMAND_HELP.doctor.description)
        .action(async () => {
            onResult(await runDoctorCommand(process.cwd()));
        });
}
