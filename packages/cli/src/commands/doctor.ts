import { join } from 'node:path';
import { styleText } from 'node:util';

import cliPackage from '#cli-package' with { type: 'json' };
import {
    CI_FILE_NOTES,
    CI_FILES,
    CI_OFF_NOTES,
    ORIGIN_URL_SETTING,
    REMOTE_URL_SCHEME,
    REMOTE_URL_USER,
    TOOL_STATE_COLORS,
    VERSION_GAP,
} from '#cli/config/commands/reports.ts';
import { EXIT_FINDINGS } from '#cli/config/engine.ts';
import { VERSION_FLAG } from '#cli/config/repository/package-managers.ts';
import { GITHUB_WORKFLOWS_FOLDER, GITLAB_CI_FILE } from '#cli/config/repository/setup.ts';
import { NODE_MODULES, PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/system.ts';
import { MISE_TOOL } from '#cli/config/tools/installers.ts';
import { AVAILABLE_TOOL_STATES, MISE_INSTALL_URL, PROJECT_ENVIRONMENT_MESSAGE } from '#cli/config/tools/programs.ts';
import { findCommandTool } from '#cli/engine/plan.ts';
import { openSession } from '#cli/engine/session.ts';
import { listHostCheckTools } from '#cli/engine/tools.ts';
import { selectRuleFiles } from '#cli/generation/rules.ts';
import { findToolName, listDistinctTools } from '#cli/manifests/read.ts';
import { listSubmodulePaths } from '#cli/repository/files/tracked.ts';
import { readGitSetting } from '#cli/repository/git/run.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { findGspotPinMismatch, readGspotPin } from '#cli/repository/version-pin.ts';
import { getOperatingSystem } from '#cli/system/environment.ts';
import { runProcess } from '#cli/system/processes.ts';
import { findProgram } from '#cli/system/programs.ts';
import { compareText } from '#cli/system/text.ts';
import { lookUpTool } from '#cli/tools/inspect.ts';
import { readHookStatus } from '#cli/tools/installers/hooks.ts';
import { findMisePin, findMissingBuild } from '#cli/tools/pins.ts';
import { findMissingEnvironment } from '#cli/tools/python-environment.ts';
import type { CommandDefinition } from '#cli/types/commands/edits.ts';
import type { CiState, DoctorReport, DoctorTool } from '#cli/types/commands/reports.ts';
import type { CommandResult } from '#cli/types/system.ts';
import type { HookStatus, Session, ToolInspection } from '#cli/types/tools.ts';

type DoctorStates = {
    hooks: string;
    ci: string;
    broken: DoctorTool[];
    commandPrograms: ReadonlySet<string>;
    systemTools: ReadonlySet<string>;
    toolsWithoutMise: ReadonlySet<string>;
    pinNotes: string[];
};

const LABEL_WIDTH = 9;

const HOOK_PROGRAM = `${NODE_MODULES}/.bin/gspot`;

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
        const label = styleText(TOOL_STATE_COLORS[tool.state], tool.state.padEnd(LABEL_WIDTH), {
            stream: process.stdout,
        });
        return `  ${label} ${formatToolVersion(tool).padEnd(width)} ${tool.note ?? ''}`.trimEnd();
    });
}

function listCommandPrograms(session: Session): ReadonlySet<string> {
    return new Set(
        session.configuredChecks
            .filter(({ configuration }) => configuration === undefined)
            .flatMap(({ check }) => [findToolName(check), check.fix?.[0]])
            .filter((name) => name !== undefined),
    );
}

/**
Look up the program of each command check and of its fix, in the repository root where check runs them, so that doctor
reports a missing one as check does. gspot install does not install such a program, so its row names its own help.
*/
async function inspectCommandTools(session: Session): Promise<Array<[string, DoctorTool]>> {
    return await Promise.all(
        [...listCommandPrograms(session)].map(async (name): Promise<[string, DoctorTool]> => {
            const tool = findCommandTool(session.toolConfigurations, name);
            const inspection = await lookUpTool(session, tool, session.root);
            const note = inspection.note ?? (AVAILABLE_TOOL_STATES.has(inspection.state) ? undefined : inspection.help);
            return [
                JSON.stringify(inspection),
                { ...inspection, ...(note !== undefined && { note }), kind: tool.kind },
            ];
        }),
    );
}

/**
Inspect the tools that gspot install installs here: every npm and PyPI tool, and each mise tool whose checks have a
file to read, as listHostCheckTools selects them.
*/
async function inspectScopeTools(session: Session): Promise<DoctorTool[]> {
    const platform = getOperatingSystem();
    const checkTools = listHostCheckTools(session);
    const pins = listDistinctTools(session.toolConfigurations).filter(
        (tool) =>
            findMissingBuild(tool, { platform, arch: process.arch }) === undefined &&
            (findMisePin(tool) === undefined || checkTools.has(tool.name)),
    );
    const lookups = session.scopes.flatMap(({ path: scopePath, configurations }) => {
        const toolNames = new Set(
            configurations.flatMap((configuration) => configuration.tools).map((tool) => tool.name),
        );
        return pins
            .filter((tool) => toolNames.has(tool.name))
            .map(async (tool): Promise<[string, DoctorTool]> => {
                const search = { ...session, runsVersionCommand: true };
                const inspection = await lookUpTool(search, tool, join(session.root, scopePath));
                return [JSON.stringify(inspection), { ...inspection, kind: tool.kind }];
            });
    });
    const inspections = new Map([...(await Promise.all(lookups)), ...(await inspectCommandTools(session))]);
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
    const providers = Object.keys(CI_OFF_NOTES) as Array<keyof typeof CI_OFF_NOTES>;
    return (
        providers.find((provider) => host.startsWith(`${provider}.com:`) || host.startsWith(`${provider}.com/`)) ?? null
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
    return { enabled: false, provider, file: null, text: provider === null ? 'none' : CI_OFF_NOTES[provider] };
}

async function readHookRunnerStatus(session: Session): Promise<HookStatus> {
    const hooks = await readHookStatus(session, session.repository);
    if (!hooks.ready || !session.settings.hooks.enabled) return hooks;
    const { command, hasBinFolder, installCommand } = session.startRunner;
    // A hook starts gspot from the bin folder, so a package manager that puts another Node.js first changes nothing.
    const versionCommand = hasBinFolder ? [HOOK_PROGRAM, VERSION_FLAG] : [...command.split(' '), VERSION_FLAG];
    const started = hasBinFolder ? [join(session.root, HOOK_PROGRAM), VERSION_FLAG] : versionCommand;
    const result = await runProcess(started, {
        cwd: session.root,
        timeoutSeconds: session.settings.tool_timeout_seconds,
    });
    if (result.code === 0) return hooks;
    const cause = result.stderr
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line !== '');
    const install = installCommand.replace('<version>', () => cliPackage.version);
    const reason = cause === undefined ? '' : `: ${cause.replace(/\.$/u, '')}`;
    const failure = `${versionCommand.join(' ')} fails${reason}. Install gspot with: ${install}`;
    return { ...hooks, ready: false, lines: [failure], text: `${hooks.text}, but ${failure}` };
}

function listMissingEnvironments(session: Session): string[] {
    const scopes = session.configuredChecks
        .filter((planned) => findMissingEnvironment(session, planned) !== undefined)
        .map((planned) => joinScope(planned.scope.path, PYTHON_ENVIRONMENT_FOLDER));
    return [...new Set(scopes)].toSorted((left, right) => compareText(left, right));
}

function listToolsWithoutMise(session: Session): ReadonlySet<string> {
    if (findProgram(MISE_TOOL) !== undefined) return new Set();
    const tools = listDistinctTools(session.toolConfigurations);
    return new Set(tools.filter((tool) => findMisePin(tool) !== undefined).map(({ name }) => name));
}

function listInstallLines(programs: DoctorTool[], states: DoctorStates): string[] {
    const installable = programs.filter(
        (tool) => !states.commandPrograms.has(tool.name) && !states.systemTools.has(tool.name),
    );
    const withoutMise = installable.filter((tool) => states.toolsWithoutMise.has(tool.name)).map(({ name }) => name);
    return [
        ...(withoutMise.length === 0
            ? []
            : [
                  `mise is not on PATH. Install mise (${MISE_INSTALL_URL}), or install these tools yourself: ${withoutMise.join(', ')}.`,
              ]),
        ...(installable.length === withoutMise.length
            ? []
            : ['Run gspot install to install the missing or outdated tools.']),
    ];
}

function formatDoctorReport(report: DoctorReport, states: DoctorStates): string {
    const programs = states.broken.filter((tool) => tool.kind === 'program');
    const systemTools = states.broken.filter((tool) => states.systemTools.has(tool.name));
    const aheadOfPin = report.tools.filter((tool) => tool.kind === 'program' && tool.state === 'newer');
    const packages = states.broken.filter(
        (tool) => tool.kind === 'package' && !states.systemTools.has(tool.name),
    ).length;
    const ready = report.tools.filter((tool) => tool.kind === 'program').length - programs.length;
    const lines = [
        ...formatTools([...programs, ...aheadOfPin]),
        ...listInstallLines(programs, states),
        ...systemTools.flatMap((tool) => tool.help ?? []),
        ...(packages === 0 ? [] : [`missing npm packages: ${String(packages)} (run gspot install)`]),
        `tools: ${String(ready)} ready`,
        ...report.environments.map(
            (path) =>
                `  ${styleText('red', 'missing'.padEnd(LABEL_WIDTH), { stream: process.stdout })} ${path}  ${PROJECT_ENVIRONMENT_MESSAGE}`,
        ),
        '',
        `hooks: ${states.hooks}`,
        ...report.submodules.map((path) => `submodule  ${path} (contents are not read)`),
        `ci: ${states.ci}`,
        `rule files: ${String(report.ruleFileCount)}`,
        `gspot      ${cliPackage.version}`,
        ...states.pinNotes,
    ];
    return `${lines.join('\n')}\n`;
}

async function runDoctorCommand(root: string): Promise<CommandResult> {
    const session = await openSession(root);
    const { text: hooksText, ...hooks } = await readHookRunnerStatus(session);
    const { text: ciText, ...ci } = await readCiState(session);
    const report: DoctorReport = {
        submodules: listSubmodulePaths(session.repository.index),
        tools: await inspectScopeTools(session),
        environments: listMissingEnvironments(session),
        hooks: { ready: hooks.ready, tool: hooks.tool ?? null, lines: hooks.lines ?? [] },
        ci,
        ruleFileCount: selectRuleFiles(session).length,
        pin: readGspotPin(root) ?? null,
    };
    const notes = [findGspotPinMismatch(root)].filter((note) => note !== undefined);
    const broken = report.tools.filter((tool) => !AVAILABLE_TOOL_STATES.has(tool.state) || tool.path === undefined);
    const hasFindings = !hooks.ready || report.environments.length > 0 || broken.length > 0 || notes.length > 0;
    return {
        text: formatDoctorReport(report, {
            hooks: hooksText,
            ci: ciText,
            broken,
            commandPrograms: listCommandPrograms(session),
            systemTools: new Set(
                session.toolConfigurations.flatMap(({ tools }) =>
                    tools.filter((tool) => tool.system === true).map((tool) => tool.name),
                ),
            ),
            toolsWithoutMise: listToolsWithoutMise(session),
            pinNotes: notes,
        }),
        json: { ...report, notes },
        exitCode: hasFindings ? EXIT_FINDINGS : 0,
    };
}

export const DOCTOR_COMMAND: CommandDefinition = {
    name: 'doctor',
    run: async ({ root }) => await runDoctorCommand(root),
};
