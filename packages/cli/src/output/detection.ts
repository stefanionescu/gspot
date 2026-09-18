// The header init prints: what it found in the repository, one row per kind.
import type { Proposal } from '#types/manifest.ts';
import type { DetectionSummary } from '#types/lifecycle.ts';

const LABEL_WIDTH = 13;
const GAP_WIDTH = 3;
const GAP = ' '.repeat(GAP_WIDTH);
const KIND_ROWS: { label: string; kind: string }[] = [
    { label: 'frameworks', kind: 'framework' },
    { label: 'platforms', kind: 'platform' },
    { label: 'databases', kind: 'database' },
    { label: 'tools', kind: 'tool' },
    { label: 'libraries', kind: 'library' },
];

function row(label: string, items: string[]): string | undefined {
    return items.length === 0 ? undefined : `${label.padEnd(LABEL_WIDTH)} ${items.join(GAP)}`;
}

function proposalsOfKind(summary: DetectionSummary, kind: string): Proposal[] {
    return summary.proposals.filter(
        (proposal) => proposal.kind === kind && summary.manifests.get(proposal.preset)?.preset.default !== true,
    );
}

function languageRow(summary: DetectionSummary): string | undefined {
    const items = proposalsOfKind(summary, 'language').map(
        (proposal) => `${proposal.preset} ${proposal.evidence.split(' ', 1)[0] ?? ''}`,
    );
    return row('languages', items);
}

function kindRows(summary: DetectionSummary): (string | undefined)[] {
    return KIND_ROWS.map(({ label, kind }) =>
        row(
            label,
            proposalsOfKind(summary, kind).map((proposal) => `${proposal.preset}  ${proposal.evidence}`),
        ),
    );
}

function scopesRow(summary: DetectionSummary): string | undefined {
    const paths = summary.scopes.filter((scope) => scope.path !== '').map((scope) => scope.path);
    if (summary.scopes.length <= 1) return row('scopes', paths);
    const isWorkspace = summary.scopes.some((scope) => scope.source === 'workspace');
    return row('scopes', [...paths, `from ${isWorkspace ? 'workspace declarations' : 'gspot.toml'}`]);
}

function toolingRows(summary: DetectionSummary): (string | undefined)[] {
    const { tooling } = summary;
    const hooks = tooling.hooks.map(
        (hook) => `${hook.path}/  ${hook.files.join(', ')} (${hook.kind === 'husky' ? 'husky' : 'hand-written'})`,
    );
    const lint = tooling.lintFolders.map((folder) => `${folder}/`);
    return [
        row('runner', tooling.runner === 'none' ? ['none'] : [`${tooling.runner}  ${tooling.runnerFile ?? ''}`]),
        row('hooks', hooks.length === 0 ? ['none'] : hooks),
        row('ci', tooling.ci.length === 0 ? ['none'] : tooling.ci),
        row('agent files', [...tooling.agentFiles, ...tooling.rulesDirectories.map((dir) => `${dir}/`)]),
        row('lint tooling', lint.length === 0 ? [] : [...lint, 'yours; gspot leaves them alone']),
    ];
}

function unknownRows(summary: DetectionSummary): string[] {
    return summary.unknown.map(
        (entry) => `${'no preset'.padEnd(LABEL_WIDTH)} ${entry.language}: ${String(entry.count)} files unchecked`,
    );
}

function ownershipRows(summary: DetectionSummary): string[] {
    const lines: string[] = [];
    if (summary.owned.length > 0) lines.push(`already configured   ${summary.owned.join('  ')}`);
    if (summary.unowned.length > 0) lines.push(`no gspot preset      ${summary.unowned.join('  ')}`);
    if (lines.length > 0) lines.push('');
    return lines;
}

/**
 * The detection header: tracked files, what each preset kind was found from, scopes, tooling, and what has no preset.
 * @param summary what init detected
 * @returns the text, ending with a blank line when tooling was found
 */
export function detectionText(summary: DetectionSummary): string {
    const rows = [languageRow(summary), ...kindRows(summary), scopesRow(summary), ...toolingRows(summary)].filter(
        (line) => line !== undefined,
    );
    return [
        `reading ${summary.files.length.toLocaleString('en-US')} tracked files`,
        '',
        ...rows,
        ...unknownRows(summary),
        '',
        ...ownershipRows(summary),
    ].join('\n');
}
