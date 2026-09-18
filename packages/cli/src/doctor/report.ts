// What doctor prints, as data and as text.
import { changeReport } from '#cli/doctor/changes.ts';
import { coverageReport } from '#cli/doctor/coverage.ts';
import { probeTool } from '#cli/doctor/probes.ts';
import { collectPins } from '#cli/render/runner-surface.ts';
import type { Session } from '#cli/run/session.ts';
import { everyManifest } from '#cli/run/session.ts';
import { selectRuleFiles } from '#cli/rules/assemble.ts';
import { paint } from '#cli/output/messages.ts';
import type { ChangeReport, CoverageReport, ToolProbe } from '#types/doctor.ts';

export type DoctorReport = {
    tools: ToolProbe[];
    coverage: CoverageReport;
    changes: ChangeReport;
    hooks: string;
    ci: string;
    rules: { files: number; unenforced: number };
    version: { running: string; pinned?: string; newer?: string };
    exitCode: number;
};

function pad(text: string, width: number): string {
    return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

/** Builds the report. */
export function doctorReport(session: Session, pinned: string | undefined, newer: string | undefined): DoctorReport {
    const tools = collectPins(everyManifest(session)).map((tool) => probeTool(session.root, tool));
    const coverage = coverageReport(session);
    const changes = changeReport(session);
    const { policy } = session.loaded;
    const report: DoctorReport = {
        tools,
        coverage,
        changes,
        hooks:
            policy.hooks.manager === 'none'
                ? 'none'
                : `${policy.hooks.manager === 'gspot' ? '.gspot/hooks' : policy.hooks.manager}  installed`,
        ci: policy.ci.provider === 'github' ? '.github/workflows/gspot.yml' : 'none',
        rules: { files: policy.rules.install ? selectRuleFiles(session).length : 0, unenforced: 0 },
        version: { running: session.version, ...(pinned ? { pinned } : {}), ...(newer ? { newer } : {}) },
        exitCode: tools.some((tool) => tool.state === 'missing' || tool.state === 'outdated') ? 1 : 0,
    };
    return report;
}

/** Renders the report the way 02-cli.md shows it. */
export function renderDoctor(report: DoctorReport): string {
    const { red, yellow, green, dim } = paint();
    const lines: string[] = ['tools'];
    const width = Math.max(...report.tools.map((tool) => `${tool.name} ${tool.want ?? ''}`.length)) + 2;
    for (const tool of report.tools) {
        const label =
            tool.state === 'ok'
                ? green('ok')
                : tool.state === 'missing'
                  ? red('missing')
                  : tool.state === 'outdated'
                    ? red('outdated')
                    : tool.state === 'newer'
                      ? yellow('newer')
                      : dim('host');
        const version =
            tool.state === 'outdated'
                ? `${tool.name} ${tool.found} (want ${tool.want})`
                : tool.state === 'newer'
                  ? `${tool.name} ${tool.found} (pinned ${tool.want})`
                  : `${tool.name} ${tool.want ?? tool.found ?? ''}`.trim();
        const tail = tool.state === 'missing' || tool.state === 'outdated' ? (tool.hint ?? '') : (tool.path ?? '');
        lines.push(`  ${pad(label, 9)} ${pad(version, width + 4)} ${tail}`.trimEnd());
    }
    lines.push('');
    if (report.coverage.unchecked.length > 0) {
        lines.push(`unchecked files          ${report.coverage.unchecked.length}`);
        const byReason = new Map<string, string[]>();
        for (const entry of report.coverage.unchecked)
            byReason.set(entry.reason, [...(byReason.get(entry.reason) ?? []), entry.path]);
        for (const [reason, paths] of byReason) {
            const shown = paths.slice(0, 4).join(' ') + (paths.length > 4 ? ' ...' : '');
            const remedy = report.coverage.unchecked.find((entry) => entry.reason === reason)?.remedy;
            lines.push(`  ${pad(shown, 40)} ${reason}${remedy ? ` (${remedy})` : ''}`);
        }
        lines.push('');
    }
    if (report.coverage.partial.length > 0) {
        lines.push(`partly checked files     ${report.coverage.partial.length}`);
        for (const entry of report.coverage.partial.slice(0, 8))
            lines.push(`  ${pad(entry.path, 40)} no check for: ${entry.missing.join(', ')}`);
        lines.push('');
    }
    const { changes } = report;
    if (changes.detectedNotSelected.length > 0) {
        lines.push('detected, not selected');
        for (const entry of changes.detectedNotSelected)
            lines.push(`  ${pad(entry.preset, 34)} ${pad(entry.evidence, 30)} ${entry.command}`);
        lines.push('');
    }
    if (changes.configurationNotOwned.length > 0) {
        lines.push('configuration not owned');
        for (const entry of changes.configurationNotOwned)
            lines.push(`  ${pad(entry.path, 34)} ${pad(entry.note, 30)} ${entry.command}`);
        lines.push('');
    }
    if (changes.changedOutsideGspot.length > 0) {
        lines.push('changed outside gspot');
        for (const entry of changes.changedOutsideGspot)
            lines.push(`  ${pad(entry.path, 34)} ${pad(entry.note, 30)} ${entry.command}`);
        lines.push('');
    }
    if (changes.pinnedTwice.length > 0) {
        lines.push('pinned twice');
        for (const entry of changes.pinnedTwice)
            lines.push(
                `  ${pad(`${entry.tool} ${entry.version}`, 34)} ${pad(entry.places.join(' and '), 40)} ${entry.command}`,
            );
        lines.push('');
    }
    lines.push(`hooks      ${report.hooks}`);
    lines.push(`ci         ${report.ci}`);
    lines.push(
        `rules      ${report.rules.files} files${report.rules.unenforced > 0 ? `, ${report.rules.unenforced} statements unenforced` : ''}`,
    );
    const pin = report.version.pinned
        ? `${report.version.pinned} pinned and ${report.version.pinned === report.version.running ? 'running' : `running ${report.version.running}`}`
        : `${report.version.running} running, no pin`;
    lines.push(
        `gspot      ${pin}${report.version.newer ? ` (${report.version.newer} available: gspot upgrade --check)` : ''}`,
    );
    return `${lines.join('\n')}\n`;
}
