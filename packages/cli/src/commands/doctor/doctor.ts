import { join } from 'node:path';
import { styleText } from 'node:util';
import { inspectTool } from '#cli/tools/inspect.ts';
import { openSession } from '#cli/engine/session.ts';
import { EXIT_FINDINGS } from '#cli/config/engine.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { spawnProcess } from '#cli/system/processes.ts';
import { readToolBinPaths } from '#cli/tools/locate.ts';
import { findMissingEnvironment } from '#cli/tools/uv.ts';
import type { CommandResult } from '#cli/types/system.ts';
import { selectRuleFiles } from '#cli/generation/rules.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { readGitSetting } from '#cli/repository/git/run.ts';
import { getOperatingSystem } from '#cli/system/environment.ts';
import { readHookStatus } from '#cli/tools/installers/hooks.ts';
import { compareText, quoteArgument } from '#cli/system/text.ts';
import { buildMiseInstall } from '#cli/tools/installers/mise.ts';
import { PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/system.ts';
import { VERSION_FLAG } from '#cli/config/repository/javascript.ts';
import { listDetectedAdditions } from '#cli/repository/proposals.ts';
import { listSuggestions } from '#cli/commands/doctor/suggestions.ts';
import { listSubmodulePaths } from '#cli/repository/files/tracked.ts';
import type { CommandDefinition } from '#cli/types/commands/edits.ts';
import { findMissingBuild, listDistinctTools } from '#cli/tools/pins.ts';
import type { Session, HookStatus, ToolInspection } from '#cli/types/tools.ts';
import type { CiState, Suggestions, DoctorReport } from '#cli/types/commands/reports.ts';
import { GITLAB_CI_FILE, GITHUB_WORKFLOWS_FOLDER } from '#cli/config/repository/setup.ts';
import { AVAILABLE_TOOL_STATES, PROJECT_ENVIRONMENT_MESSAGE } from '#cli/config/tools/programs.ts';

import {
    CI_FILES,
    VERSION_GAP,
    CI_OFF_NOTES,
    CI_FILE_NOTES,
    COLUMN_WIDTHS,
    REMOTE_URL_USER,
    TOOL_STATE_COLORS,
    REMOTE_URL_SCHEME,
    ORIGIN_URL_SETTING,
    SUGGESTION_SECTIONS,
} from '#cli/config/commands/reports.ts';

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
        const label = styleText(TOOL_STATE_COLORS[tool.state], tool.state.padEnd(COLUMN_WIDTHS.label), {
            stream: process.stdout,
        });
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
    const miseBinPaths = readToolBinPaths(session, buildMiseInstall(session.toolConfigurations).content);
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

async function detectCiProvider(root: string, paths: string[]): Promise<CiState['provider']> {
    if (paths.includes(GITLAB_CI_FILE)) return 'gitlab';
    if (paths.some((path) => path.startsWith(GITHUB_WORKFLOWS_FOLDER))) return 'github';
    const remote = (await readGitSetting(root, ORIGIN_URL_SETTING)) ?? '';
    const host = remote.replace(REMOTE_URL_SCHEME, '').replace(REMOTE_URL_USER, '');
    return (Object.keys(CI_OFF_NOTES) as (keyof typeof CI_OFF_NOTES)[]).find(
        (provider) => host.startsWith(`${provider}.com:`) || host.startsWith(`${provider}.com/`),
    );
}

async function readCiState(session: Session): Promise<CiState & { text: string }> {
    const ci = session.settings.ci;
    if (ci?.enabled === true) {
        const { provider } = ci;
        const file = CI_FILES[provider];
        return { enabled: true, provider, file, text: `${file}${CI_FILE_NOTES[provider]}` };
    }
    const provider = await detectCiProvider(
        session.root,
        session.repository.files.map((file) => file.path),
    );
    return provider === undefined
        ? { enabled: false, text: 'none' }
        : { enabled: false, provider, text: CI_OFF_NOTES[provider] };
}

async function readHookState(session: Session): Promise<HookStatus> {
    const hooks = await readHookStatus(session, session.repository);
    if (!hooks.ready || session.settings.hooks?.enabled !== true) return hooks;
    const { command, installCommand } = session.startRunner;
    const versionCommand = [...command.split(' '), VERSION_FLAG];
    const result = await spawnProcess(versionCommand, { cwd: session.root, timeoutSeconds: session.timeoutSeconds });
    if (result.code === 0) return hooks;
    const install = installCommand.replace('<version>', () => cliPackage.version);
    const failure = `${versionCommand.join(' ')} fails. Install gspot with: ${install}`;
    return { ...hooks, ready: false, lines: [failure], text: `${hooks.text}, but ${failure}` };
}

function listMissingEnvironments(session: Session): string[] {
    const scopes = session.configuredChecks
        .filter((planned) => findMissingEnvironment(session, planned) !== undefined)
        .map((planned) => joinScope(planned.scope.path, PYTHON_ENVIRONMENT_FOLDER));
    return [...new Set(scopes)].toSorted((left, right) => compareText(left, right));
}

function formatDoctorReport(report: DoctorReport, states: { hooks: string; ci: string }): string {
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
                `  ${styleText('red', 'missing'.padEnd(COLUMN_WIDTHS.label), { stream: process.stdout })} ${path}  ${PROJECT_ENVIRONMENT_MESSAGE}`,
        ),
        '',
        ...formatSuggestions(report.suggestions),
        ...(report.addCommands.length === 0
            ? []
            : [`Run ${report.addCommands.join(', then ')} to add the detected configurations.`, '']),
        `hooks: ${states.hooks}`,
        ...report.submodules.map((path) => `submodule  ${path} (contents are not read)`),
        `ci: ${states.ci}`,
        `rule files: ${String(report.ruleFiles)}`,
        `gspot      ${cliPackage.version}`,
    ];
    return `${lines.join('\n')}\n`;
}

async function runDoctorCommand(root: string): Promise<CommandResult> {
    const session = await openSession(root);
    const { text: hooksText, ...hooks } = await readHookState(session);
    const { text: ciText, ...ci } = await readCiState(session);
    const report: DoctorReport = {
        submodules: listSubmodulePaths(session.repository.index),
        tools: inspectScopeTools(session),
        environments: listMissingEnvironments(session),
        suggestions: await listSuggestions(session),
        addCommands: listDetectedAdditions(session).map(({ scope, configurations }) =>
            ['gspot add', ...configurations, ...(scope === '' ? [] : ['--scope', quoteArgument(scope)])].join(' '),
        ),
        hooks,
        ci,
        ruleFiles: selectRuleFiles(session).length,
    };
    const isBroken =
        !hooks.ready ||
        report.environments.length > 0 ||
        report.tools.some((tool) => !AVAILABLE_TOOL_STATES.has(tool.state) || tool.path === undefined);
    return {
        text: formatDoctorReport(report, { hooks: hooksText, ci: ciText }),
        json: report,
        exitCode: isBroken ? EXIT_FINDINGS : 0,
    };
}

export const doctorCommand: CommandDefinition = {
    name: 'doctor',
    run: async (_arguments, _flags, { root }) => await runDoctorCommand(root),
};
