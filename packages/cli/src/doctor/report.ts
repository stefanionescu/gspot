// What doctor prints, as data and as text.
import type { Session } from '#types/run.ts';
import type { Painter } from '#types/output.ts';
import { paint } from '#cli/output/messages.ts';
import { everyManifest } from '#cli/run/session.ts';
import { changeReport } from '#cli/doctor/changes.ts';
import { collectPins } from '#cli/emit/runner-tasks.ts';
import { probeTool } from '#cli/platform/tool-probe.ts';
import { coverageReport } from '#cli/doctor/coverage.ts';
import { selectRuleFiles } from '#cli/rules/assemble.ts';
import type { ChangeKey, ChangeReport, DoctorReport, ToolProbe } from '#types/doctor.ts';

const LABEL_WIDTH = 9;
const VERSION_GAP = 4;
const PATH_WIDTH = 40;
const NAME_WIDTH = 34;
const NOTE_WIDTH = 30;
const PATHS_SHOWN = 4;
const PARTIAL_SHOWN = 8;

const CHANGE_SECTIONS: { key: ChangeKey; title: string }[] = [
    { key: 'detectedNotSelected', title: 'detected, not selected' },
    { key: 'recommendedNotSelected', title: 'recommended, not selected' },
    { key: 'configurationNotOwned', title: 'configuration not owned' },
    { key: 'changedOutsideGspot', title: 'changed outside gspot' },
];

function hooksLine(tool: string): string {
    if (tool === 'none') return 'none';
    return `${tool === 'gspot' ? '.gspot/hooks' : tool}  installed`;
}

function stateLabel(tool: ToolProbe, colors: Painter): string {
    const { red, green, dim } = colors;
    switch (tool.state) {
        case 'ok': {
            return green('ok');
        }
        case 'missing': {
            return red('missing');
        }
        case 'outdated': {
            return red('outdated');
        }
        case 'newer': {
            return red('newer');
        }
        case 'host': {
            return dim('host');
        }
    }
}

function versionText(tool: ToolProbe): string {
    const found = tool.found ?? '';
    const want = tool.want ?? '';
    if (tool.state === 'outdated') return `${tool.name} ${found} (want ${want})`;
    if (tool.state === 'newer') return `${tool.name} ${found} (pinned ${want})`;
    return `${tool.name} ${want === '' ? found : want}`.trim();
}

function toolLines(tools: ToolProbe[], colors: Painter): string[] {
    const width = Math.max(...tools.map((tool) => `${tool.name} ${tool.want ?? ''}`.length)) + VERSION_GAP;
    return tools.map((tool) => {
        const isBroken = tool.state !== 'ok' && tool.state !== 'host';
        const tail = isBroken ? (tool.hint ?? '') : (tool.path ?? '');
        const label = stateLabel(tool, colors).padEnd(LABEL_WIDTH);
        return `  ${label} ${versionText(tool).padEnd(width)} ${tail}`.trimEnd();
    });
}

function uncheckedLines(report: DoctorReport): string[] {
    const { unchecked } = report.coverage;
    if (unchecked.length === 0) return [];
    const byReason = new Map<string, string[]>();
    for (const entry of unchecked) byReason.set(entry.reason, [...(byReason.get(entry.reason) ?? []), entry.path]);
    const lines = [`unchecked files          ${String(unchecked.length)}`];
    for (const [reason, paths] of byReason) {
        const more = paths.length > PATHS_SHOWN ? ' ...' : '';
        const shown = paths.slice(0, PATHS_SHOWN).join(' ') + more;
        const remedy = unchecked.find((entry) => entry.reason === reason)?.remedy;
        const hint = remedy === undefined ? '' : ` (${remedy})`;
        lines.push(`  ${shown.padEnd(PATH_WIDTH)} ${reason}${hint}`);
    }
    return [...lines, ''];
}

function partialLines(report: DoctorReport): string[] {
    const { partial } = report.coverage;
    if (partial.length === 0) return [];
    const lines = partial
        .slice(0, PARTIAL_SHOWN)
        .map((entry) => `  ${entry.path.padEnd(PATH_WIDTH)} no check for: ${entry.missing.join(', ')}`);
    return [`partly checked files     ${String(partial.length)}`, ...lines, ''];
}

function changeRow(first: string, second: string, command: string): string {
    return `  ${first.padEnd(NAME_WIDTH)} ${second.padEnd(NOTE_WIDTH)} ${command}`;
}

function sectionLines(title: string, rows: string[]): string[] {
    return rows.length === 0 ? [] : [title, ...rows, ''];
}

function changeLines(changes: ChangeReport): string[] {
    const sections = CHANGE_SECTIONS.map(({ key, title }) =>
        sectionLines(
            title,
            changes[key].map((entry) =>
                changeRow(
                    'preset' in entry ? entry.preset : entry.path,
                    'evidence' in entry ? entry.evidence : entry.note,
                    entry.command,
                ),
            ),
        ),
    );
    const pinned = changes.pinnedTwice.map((entry) => {
        const name = `${entry.tool} ${entry.version}`.padEnd(NAME_WIDTH);
        return `  ${name} ${entry.places.join(' and ').padEnd(PATH_WIDTH)} ${entry.command}`;
    });
    return [...sections.flat(), ...sectionLines('pinned twice', pinned)];
}

function versionLine(report: DoctorReport): string {
    const { running, pinned } = report.version;
    const runningText = pinned === running ? 'running' : `running ${running}`;
    const pin = pinned === undefined ? `${running} running, no pin` : `${pinned} pinned and ${runningText}`;
    return `gspot      ${pin}`;
}

/**
 * Builds the report: tool probes, coverage, changes after the install, hooks, CI, rules and versions.
 * @param session the session
 * @param pinned the version `.gspot/version` pins, if any
 * @returns the report, with exit code 1 when a tool is missing or outdated
 */
export function doctorReport(session: Session, pinned: string | undefined): DoctorReport {
    const scopePaths = session.scopes.map((entry) => entry.scope.path).filter((path) => path !== '');
    const tools = collectPins(everyManifest(session)).map((tool) => probeTool(session.root, tool, scopePaths));
    const { policy } = session.policyFiles;
    const isBroken = tools.some((tool) => tool.state !== 'ok' && tool.state !== 'host');
    return {
        tools,
        coverage: coverageReport(session),
        changes: changeReport(session),
        hooks: hooksLine(policy.hooks.tool),
        ci: policy.ci.provider === 'github' ? '.github/workflows/gspot.yml' : 'none',
        rules: { files: policy.rules.install ? selectRuleFiles(session).length : 0 },
        version: {
            running: session.version,
            ...(pinned === undefined ? {} : { pinned }),
        },
        exitCode: isBroken ? 1 : 0,
    };
}

/**
 * The report as text, the way 02-cli.md shows it.
 * @param report the report
 * @returns the text for stdout
 */
export function doctorText(report: DoctorReport): string {
    const colors = paint();
    const lines = [
        'tools',
        ...toolLines(report.tools, colors),
        '',
        ...uncheckedLines(report),
        ...partialLines(report),
        ...changeLines(report.changes),
        `hooks      ${report.hooks}`,
        `ci         ${report.ci}`,
        `rules      ${String(report.rules.files)} files`,
        versionLine(report),
    ];
    return `${lines.join('\n')}\n`;
}
