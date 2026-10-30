import { join } from 'node:path';
import { readGitSetting } from '#cli/system/git.ts';
import { getColors } from '#cli/system/terminal.ts';
import { inspectTool } from '#cli/tools/inspect.ts';
import type { Session } from '#cli/types/session.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { openSession } from '#cli/planning/session.ts';
import { EXIT_FINDINGS } from '#cli/config/terminal.ts';
import { spawnProcess } from '#cli/system/processes.ts';
import { readToolBinPaths } from '#cli/tools/locate.ts';
import { readHookStatus } from '#cli/installers/hooks.ts';
import type { Command } from '@commander-js/extra-typings';
import { selectRuleFiles } from '#cli/generation/rules.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { VERSION_FLAG } from '#cli/config/tools/versions.ts';
import { readRepositoryRoot } from '#cli/repository/read.ts';
import { getOperatingSystem } from '#cli/system/environment.ts';
import { compareText, quoteArgument } from '#cli/system/text.ts';
import { findMissingProjectEnvironment } from '#cli/tools/uv.ts';
import type { HookStatus } from '#cli/types/installers/hooks.ts';
import { buildMiseProject } from '#cli/generation/tool-projects.ts';
import { AVAILABLE_TOOL_STATES } from '#cli/config/tools/inspect.ts';
import type { ToolInspection } from '#cli/types/tools/inspection.ts';
import { listSuggestions } from '#cli/commands/doctor/suggestions.ts';
import { listSubmodulePaths } from '#cli/repository/files/tracked.ts';
import { PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/files/names.ts';
import { listDetectedAdditions } from '#cli/repository/configurations.ts';
import type { Suggestions, DoctorReport } from '#cli/types/commands/doctor.ts';
import type { CommandResult, CommandCompletion } from '#cli/types/terminal.ts';
import { findMissingBuild, listDistinctTools } from '#cli/configurations/tools.ts';
import { GITLAB_CI_FILE, GITHUB_WORKFLOWS_FOLDER } from '#cli/config/repository/setup.ts';

import {
    VERSION_GAP,
    CI_OFF_NOTES,
    COLUMN_WIDTHS,
    CI_FILE_LABELS,
    REMOTE_URL_USER,
    TOOL_STATE_COLORS,
    REMOTE_URL_SCHEME,
    ORIGIN_URL_SETTING,
    SUGGESTION_SECTIONS,
    ENVIRONMENT_MISSING_NOTE,
} from '#cli/config/commands/doctor.ts';

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
        const tail = !AVAILABLE_TOOL_STATES.has(tool.state) || tool.path === undefined ? (tool.note ?? '') : tool.path;
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

function inspectScopeTools(session: Session): ToolInspection[] {
    const platform = getOperatingSystem();
    const inspections = new Map<string, ToolInspection>();
    const pins = listDistinctTools(session.toolConfigurations).filter(
        (tool) => findMissingBuild(tool, { platform, arch: process.arch }) === undefined,
    );
    const miseBinPaths = readToolBinPaths(session, buildMiseProject(session.toolConfigurations).content);
    for (const { path: scopePath, configurations } of session.scopes) {
        const toolNames = new Set(
            configurations.flatMap((configuration) => configuration.tools).map((tool) => tool.name),
        );
        for (const tool of pins) {
            if (!toolNames.has(tool.name)) continue;
            const inspection = inspectTool({ ...session, cwd: join(session.root, scopePath), miseBinPaths }, tool);
            inspections.set(JSON.stringify(inspection), inspection);
        }
    }
    return inspections
        .values()
        .toArray()
        .toSorted((left, right) => compareText(left.name, right.name));
}

function detectCiProvider(root: string, paths: string[]): keyof typeof CI_OFF_NOTES | undefined {
    if (paths.includes(GITLAB_CI_FILE)) return 'gitlab';
    if (paths.some((path) => path.startsWith(GITHUB_WORKFLOWS_FOLDER))) return 'github';
    const remote = readGitSetting(root, ORIGIN_URL_SETTING) ?? '';
    const host = remote.replace(REMOTE_URL_SCHEME, '').replace(REMOTE_URL_USER, '');
    return (Object.keys(CI_OFF_NOTES) as (keyof typeof CI_OFF_NOTES)[]).find(
        (provider) => host.startsWith(`${provider}.com:`) || host.startsWith(`${provider}.com/`),
    );
}

function formatCiState(session: Session): string {
    const ci = session.settings.ci;
    if (ci?.enabled === true) return CI_FILE_LABELS[ci.provider];
    const provider = detectCiProvider(
        session.root,
        session.repository.files.map((file) => file.path),
    );
    return provider === undefined ? 'none' : CI_OFF_NOTES[provider];
}

async function readHookState(session: Session): Promise<HookStatus> {
    const hooks = readHookStatus(session, session.repository);
    if (!hooks.ready || session.settings.hooks?.enabled !== true) return hooks;
    const { command, installCommand } = session.startRunner;
    const versionCommand = [...command.split(' '), VERSION_FLAG];
    const result = await spawnProcess(versionCommand, { cwd: session.root, timeoutSeconds: session.timeoutSeconds });
    if (result.code === 0) return hooks;
    const install = installCommand.replace('<version>', () => cliPackage.version);
    return {
        ready: false,
        text: `${hooks.text}, but ${versionCommand.join(' ')} fails. Install gspot with: ${install}`,
    };
}

function listMissingEnvironments(session: Session): string[] {
    const scopes = session.configuredChecks
        .filter((planned) => findMissingProjectEnvironment(session, planned) !== undefined)
        .map((planned) => joinScope(planned.scope.path, PYTHON_ENVIRONMENT_FOLDER));
    return [...new Set(scopes)].toSorted((left, right) => compareText(left, right));
}

async function buildDoctorReport(session: Session): Promise<DoctorReport> {
    const tools = inspectScopeTools(session);
    const environments = listMissingEnvironments(session);
    const hooks = await readHookState(session);
    const isBroken =
        !hooks.ready ||
        environments.length > 0 ||
        tools.some((tool) => !AVAILABLE_TOOL_STATES.has(tool.state) || tool.path === undefined);
    return {
        submodules: listSubmodulePaths(session.repository.index),
        tools,
        environments,
        suggestions: listSuggestions(session),
        addCommands: listDetectedAdditions(session).map(({ scope, configurations }) =>
            ['gspot add', ...configurations, ...(scope === '' ? [] : ['--scope', quoteArgument(scope)])].join(' '),
        ),
        hooks: hooks.text,
        ci: formatCiState(session),
        ruleFiles: selectRuleFiles(session).length,
        exitCode: isBroken ? EXIT_FINDINGS : 0,
    };
}

function formatDoctorReport(report: DoctorReport): string {
    const lines = [
        ...formatTools(
            report.tools.filter((tool) => !AVAILABLE_TOOL_STATES.has(tool.state) || tool.path === undefined),
        ),
        ...(report.tools.some((tool) => !AVAILABLE_TOOL_STATES.has(tool.state) || tool.path === undefined)
            ? ['Run gspot install to install the missing or outdated tools.']
            : []),
        `tools: ${String(report.tools.filter((tool) => AVAILABLE_TOOL_STATES.has(tool.state) && tool.path !== undefined).length)} ready`,
        ...report.environments.map(
            (path) =>
                `  ${getColors().red('missing'.padEnd(COLUMN_WIDTHS.label))} ${path}  ${ENVIRONMENT_MISSING_NOTE}`,
        ),
        '',
        ...formatSuggestions(report.suggestions),
        ...(report.addCommands.length === 0
            ? []
            : [`Run ${report.addCommands.join(', then ')} to add the detected configurations.`, '']),
        `hooks: ${report.hooks}`,
        ...report.submodules.map((path) => `submodule  ${path} (contents are not read)`),
        `ci: ${report.ci}`,
        `rule files: ${String(report.ruleFiles)}`,
        `gspot      ${cliPackage.version}`,
    ];
    return `${lines.join('\n')}\n`;
}

async function runDoctorCommand(cwd: string): Promise<CommandResult> {
    const root = readRepositoryRoot(cwd);
    const session = await openSession(root);
    const report = await buildDoctorReport(session);
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
