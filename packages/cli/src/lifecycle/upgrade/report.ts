// What this gspot version changes in a repository pinned to another: the pins, the generated files, the rules those files carry, the rule files, the presets on offer and the extra keys with a slot.
import { join } from 'node:path';
import type { Session } from '#types/run.ts';
import { parse as parseToml } from 'smol-toml';
import type { DriftEntry } from '#types/emit.ts';
import { computeDrift } from '#cli/emit/drift.ts';
import { existsSync, readFileSync } from 'node:fs';
import { misePin } from '#cli/emit/runner-tasks.ts';
import { changeReport } from '#cli/doctor/changes.ts';
import type { UpgradeReport } from '#types/lifecycle.ts';
import type { ToolPin, InstallerPin } from '#types/manifest.ts';

const MISE_PATH = '.config/mise/conf.d/gspot.toml';
const PACKAGE_PATH = 'package.json';
const RULE_LINE = /^[+-]\s*'([^']+)':/u;
const DIFF_BODY = /^[+-](?![+-])/u;

function misePins(root: string): [string, string][] {
    const path = join(root, MISE_PATH);
    if (!existsSync(path)) return [];
    const parsed = parseToml(readFileSync(path, 'utf8')) as { tools?: Record<string, unknown> };
    return Object.entries(parsed.tools ?? {}).flatMap(([key, value]) => {
        return typeof value === 'string' ? [[key, value] as [string, string]] : [];
    });
}

function packagePins(root: string): [string, string][] {
    const path = join(root, PACKAGE_PATH);
    if (!existsSync(path)) return [];
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { devDependencies?: Record<string, unknown> };
    return Object.entries(parsed.devDependencies ?? {}).flatMap(([name, value]) =>
        typeof value === 'string' ? [[name, value.replace(/^[\^~]/u, '')] as [string, string]] : [],
    );
}

function installedPin(tool: ToolPin, pinned: Map<string, string>): InstallerPin | undefined {
    const npm = tool.installers['npm'];
    if (npm !== undefined && pinned.has(npm.name)) return npm;
    return misePin(tool);
}

function toolChange(
    tool: ToolPin,
    preset: string,
    pinned: Map<string, string>,
): UpgradeReport['tools'][number] | undefined {
    const pin = installedPin(tool, pinned);
    if (pin?.version === undefined) return undefined;
    const { version } = pin;
    const before = pinned.get(pin.name);
    if (before === undefined) return { tool: tool.name, to: version, requiredBy: preset };
    return before === version ? undefined : { tool: tool.name, from: before, to: version, requiredBy: preset };
}

function toolChanges(session: Session): UpgradeReport['tools'] {
    if (session.policyFiles.policy.runner === undefined) return [];
    const pinned = new Map([...misePins(session.root), ...packagePins(session.root)]);
    const seen = new Set<string>();
    return session.scopes.flatMap((scope) =>
        scope.selected.flatMap((manifest) =>
            manifest.tools.flatMap((tool) => {
                if (seen.has(tool.name)) return [];
                seen.add(tool.name);
                const change = toolChange(tool, manifest.preset.name, pinned);
                return change === undefined ? [] : [change];
            }),
        ),
    );
}

function changedLines(entry: DriftEntry): number {
    return (entry.diff ?? '').split('\n').filter((line) => DIFF_BODY.test(line)).length;
}

function fileChange(entry: DriftEntry): UpgradeReport['files'][number] {
    if (entry.kind === 'missing') return { path: entry.path, kind: 'new' };
    if (entry.kind === 'stray') return { path: entry.path, kind: 'removed' };
    return { path: entry.path, kind: 'changed', lines: changedLines(entry) };
}

function ruleChanges(entries: DriftEntry[]): UpgradeReport['rules'] {
    return entries.flatMap((entry) =>
        (entry.diff ?? '')
            .split('\n')
            .map((line) => ({ line, rule: RULE_LINE.exec(line)?.[1] }))
            .filter((match): match is { line: string; rule: string } => match.rule !== undefined)
            .map((match) => ({
                rule: match.rule,
                path: entry.path,
                kind: match.line.startsWith('+') ? 'added' : 'removed',
            })),
    );
}

function extraSlotsOf(session: Session, index: number): UpgradeReport['extras'] {
    const scope = session.scopes[index];
    if (scope === undefined) return [];
    return Object.entries(scope.view.settings)
        .filter(([key]) => key.startsWith('tools.') && key.endsWith('.extra'))
        .flatMap(([key, value]) => {
            if (value === null || typeof value !== 'object') return [];
            const tool = key.slice('tools.'.length, -'.extra'.length);
            return Object.keys(value)
                .filter((name) => name !== 'reason' && scope.surface.specs.has(`tools.${tool}.${name}`))
                .map((name) => ({ tool, key: name, scope: scope.scope.path }));
        });
}

function fileLines(files: UpgradeReport['files']): string[] {
    return files.map((file) => {
        if (file.kind === 'new') return `  + ${file.path}  new`;
        if (file.kind === 'removed') return `  - ${file.path}  removed`;
        return `  ~ ${file.path}  ${String(file.lines ?? 0)} lines changed`;
    });
}

function section(title: string, lines: string[]): string[] {
    return lines.length === 0 ? [] : [title, ...lines, ''];
}

function toolLine(tool: UpgradeReport['tools'][number]): string {
    return tool.from === undefined
        ? `  + ${tool.tool}  ${tool.to}  new, required by ${tool.requiredBy}`
        : `  ~ ${tool.tool}  ${tool.from} -> ${tool.to}`;
}

function extraLine(entry: UpgradeReport['extras'][number]): string {
    const where = entry.scope === '' ? '' : ` (${entry.scope})`;
    return `  tools.${entry.tool}.${entry.key}  move it up${where}`;
}

/**
 * The upgrade report: what this binary's render, pins and presets change against what is on disk.
 * @param session the session under the target version
 * @returns the report
 */
export function upgradeReport(session: Session): UpgradeReport {
    const rulesDirectory = `${session.policyFiles.policy.rules.directory.replace(/\/$/u, '')}/`;
    const drift = computeDrift(session);
    const ruleFiles = drift.filter((entry) => entry.path.startsWith(rulesDirectory));
    const configuration = drift.filter((entry) => !entry.path.startsWith(rulesDirectory));
    return {
        tools: toolChanges(session),
        rules: ruleChanges(configuration),
        files: configuration.map((entry) => fileChange(entry)),
        ruleFiles: ruleFiles.map((entry) => fileChange(entry)),
        presets: changeReport(session).detectedNotSelected.map((entry) => ({
            preset: entry.preset,
            evidence: entry.evidence,
        })),
        extras: session.scopes.flatMap((_scope, index) => extraSlotsOf(session, index)),
    };
}

/**
 * The report as the lines upgrade prints.
 * @param report the report
 * @returns the lines
 */
export function upgradeReportLines(report: UpgradeReport): string[] {
    const lines = [
        ...section(
            'rules',
            report.rules.map((rule) => `  ${rule.kind === 'added' ? '+' : '-'} ${rule.rule}  (${rule.path})`),
        ),
        ...section(
            'tools',
            report.tools.map((tool) => toolLine(tool)),
        ),
        ...section('generated configuration', fileLines(report.files)),
        ...section('rule files', fileLines(report.ruleFiles)),
        ...section(
            'presets available, not selected',
            report.presets.map((entry) => `  ${entry.preset}  ${entry.evidence}`),
        ),
        ...section(
            'extra keys that now have a slot',
            report.extras.map((entry) => extraLine(entry)),
        ),
    ];
    return lines.length === 0 ? ['nothing changes beyond the pin', ''] : lines;
}
