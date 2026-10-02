import type { Colors } from 'picocolors/types';
import { collectPins } from '#cli/tools/pins.ts';
import { colors } from '#cli/output/messages.ts';
import { everyManifest } from '#cli/kits/select.ts';
import { inspectTool } from '#cli/tools/inspect.ts';
import { selectRuleFiles } from '#cli/rules/assemble.ts';
import { hookStatus } from '#cli/lifecycle/hooks-path.ts';
import { submodulePaths } from '#cli/repository/tracked.ts';
import { getChanges } from '#cli/commands/doctor/changes.ts';
import { missingBuild } from '#cli/execution/planning/skips.ts';
import { EXIT_FINDINGS } from '#cli/config/platform/platform.ts';
import { PLATFORM_NAMES } from '#cli/config/execution/planning.ts';
import type { Session, ToolInspection } from '#cli/types/tools/tools.ts';
import type { ChangeReport, DoctorReport } from '#cli/types/commands/doctor.ts';
import { VERSION_GAP, COLUMN_WIDTHS, CHANGE_SECTIONS } from '#cli/config/commands/doctor.ts';

function stateLabel(tool: ToolInspection, colors: Colors): string {
    const { red, green, dim } = colors;
    switch (tool.state) {
        case 'ok': {
            return green('ok'.padEnd(COLUMN_WIDTHS.label));
        }
        case 'error': {
            return red('error'.padEnd(COLUMN_WIDTHS.label));
        }
        case 'missing': {
            return red('missing'.padEnd(COLUMN_WIDTHS.label));
        }
        case 'outdated': {
            return red('outdated'.padEnd(COLUMN_WIDTHS.label));
        }
        case 'newer': {
            return red('newer'.padEnd(COLUMN_WIDTHS.label));
        }
        case 'host': {
            return dim('host'.padEnd(COLUMN_WIDTHS.label));
        }
    }
}

function versionText(tool: ToolInspection): string {
    const found = tool.found ?? '';
    const want = tool.want ?? '';
    if (tool.state === 'outdated') return `${tool.name} ${found} (want ${want})`;
    if (tool.state === 'newer') return `${tool.name} ${found} (pinned ${want})`;
    return `${tool.name} ${want === '' ? found : want}`.trim();
}

function toolLines(tools: ToolInspection[], colors: Colors): string[] {
    const width = Math.max(...tools.map((tool) => versionText(tool).length)) + VERSION_GAP;
    return tools.map((tool) => {
        const isBroken = tool.state !== 'ok' && tool.state !== 'host';
        const tail = isBroken
            ? [tool.note, tool.hint].filter((part) => part !== undefined).join(' ')
            : (tool.path ?? '');
        const label = stateLabel(tool, colors);
        return `  ${label} ${versionText(tool).padEnd(width)} ${tail}`.trimEnd();
    });
}

function changeLines(changes: ChangeReport): string[] {
    const sections = CHANGE_SECTIONS.map(({ key, title }) => {
        const rows = changes[key].map((entry) => {
            const name = ('kit' in entry ? entry.kit : entry.path).padEnd(COLUMN_WIDTHS.name);
            const detail = ('evidence' in entry ? entry.evidence : entry.note).padEnd(COLUMN_WIDTHS.note);
            return `  ${name} ${detail} ${entry.command}`;
        });
        return rows.length === 0 ? [] : [title, ...rows, ''];
    });
    const pinned = changes.pinnedTwice.map((entry) => {
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
 * Builds the report: tool inspections, changes after the install, hooks, CI, rules, and versions.
 * @param session the session
 * @param pinned the version `.gspot/version` pins, if any
 * @returns the report, with exit code 1 when tools or hook integration need correction
 */
export function buildReport(session: Session, pinned: string | undefined): DoctorReport {
    const platform = PLATFORM_NAMES[process.platform] ?? process.platform;
    // A tool with no build for this host is left out: the checks that need it skip here.
    const tools = collectPins(everyManifest(session.scopes))
        .filter((tool) => missingBuild(tool, platform, process.arch) === undefined)
        .map((tool) => inspectTool(session, tool));
    const { policy } = session.policyFiles;
    const hooks = hookStatus({ policy: session.policyFiles.policy, repository: session.repository });
    const isBroken = !hooks.ready || tools.some((tool) => tool.state !== 'ok' && tool.state !== 'host');
    let ci = 'none';
    if (policy.ci !== undefined)
        ci =
            policy.ci.provider === 'github'
                ? '.github/workflows/gspot.yml'
                : '.gitlab/ci/gspot.yml (include from .gitlab-ci.yml)';
    return {
        submodules: submodulePaths(session.root),
        tools,
        changes: getChanges(session),
        hooks: hooks.text,
        ci,
        rules: {
            files: policy.rules.install
                ? selectRuleFiles(session.policyFiles.policy.rules, everyManifest(session.scopes), session.repository)
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
 * The report as text: one line per tool, then the changes, hooks, CI, rules, and versions.
 * @param report the report
 * @returns the text for stdout
 */
export function formatReport(report: DoctorReport): string {
    const lines = [
        'tools',
        ...toolLines(report.tools, colors),
        '',
        ...changeLines(report.changes),
        `hooks      ${report.hooks}`,
        ...report.submodules.map((path) => `submodule  ${path} (contents are not read)`),
        `ci         ${report.ci}`,
        `rules      ${String(report.rules.files)} files`,
        versionLine(report),
    ];
    return `${lines.join('\n')}\n`;
}
