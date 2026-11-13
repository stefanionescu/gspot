import { join } from 'node:path';
import { styleText } from 'node:util';

import cliPackage from '#cli-package' with { type: 'json' };
import {
    CI_FILE_SUFFIXES,
    CI_OFF_NOTES,
    LABEL_WIDTH,
    TOOL_STATE_COLORS,
    VERSION_GAP,
} from '#cli/config/commands/lookup.ts';
import { CI_FILES } from '#cli/config/generation/builders.ts';
import { EXIT_FINDINGS, MISE_PROGRAM, PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/system.ts';
import { AVAILABLE_TOOL_STATES, MISE_INSTALL_URL, PROJECT_ENVIRONMENT_MESSAGE } from '#cli/config/tools/programs.ts';
import { listHostCheckTools } from '#cli/engine/plan/tools.ts';
import { openSession } from '#cli/engine/session.ts';
import { selectRuleFiles } from '#cli/generation/builders/rules.ts';
import { findCommandTool, findToolName, listDistinctTools, listToolNames } from '#cli/manifests/tools.ts';
import { listSubmodulePaths } from '#cli/repository/files/tracked.ts';
import { findGspotPinMismatch, readGspotPin } from '#cli/repository/projects/pin.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { detectCiProvider } from '#cli/repository/setup/read.ts';
import { readHost } from '#cli/system/environment.ts';
import { findProgram } from '#cli/system/processes/programs.ts';
import { compareText } from '#cli/system/text/order.ts';
import { readHookRunnerStatus } from '#cli/tools/installers/hooks.ts';
import { findMissingEnvironment } from '#cli/tools/missing.ts';
import { findMisePin, findMissingBuild } from '#cli/tools/pins.ts';
import { lookUpTool } from '#cli/tools/programs/inspect.ts';
import type {
    CiState,
    CommandDefinition,
    CommandLocation,
    DoctorReport,
    DoctorStates,
    DoctorTool,
} from '#cli/types/commands.ts';
import type { CommandResult } from '#cli/types/system.ts';
import type { Session, ToolInspection } from '#cli/types/tools.ts';

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
    const host = readHost();
    const checkTools = listHostCheckTools(session);
    const pins = listDistinctTools(session.toolConfigurations).filter(
        (tool) =>
            findMissingBuild(tool, host) === undefined &&
            (findMisePin(tool) === undefined || checkTools.has(tool.name)),
    );
    const lookups = session.scopes.flatMap(({ path: scopePath, configurations }) => {
        const toolNames = listToolNames(configurations);
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

async function readCiState(session: Session): Promise<CiState & { text: string }> {
    const ci = session.settings.ci;
    if (ci?.enabled === true) {
        const { provider } = ci;
        const file = CI_FILES[provider];
        return { enabled: true, provider, file, text: `${file}${CI_FILE_SUFFIXES[provider]}` };
    }
    const provider = await detectCiProvider(
        session.root,
        session.repository.files.map((file) => file.path),
    );
    return { enabled: false, provider, file: null, text: provider === null ? 'none' : CI_OFF_NOTES[provider] };
}

function listMissingEnvironments(session: Session): string[] {
    const scopes = session.configuredChecks
        .filter((planned) => findMissingEnvironment(session, planned) !== undefined)
        .map((planned) => joinScope(planned.scope.path, PYTHON_ENVIRONMENT_FOLDER));
    return [...new Set(scopes)].toSorted((left, right) => compareText(left, right));
}

function listToolsWithoutMise(session: Session): ReadonlySet<string> {
    if (findProgram(MISE_PROGRAM) !== undefined) return new Set();
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

async function runDoctorCommand({ root }: CommandLocation): Promise<CommandResult> {
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
    run: runDoctorCommand,
};
