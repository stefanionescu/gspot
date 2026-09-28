// The header init prints: what it found in the repository, one row per kind.
import type { DetectionSummary } from '#cli/types/commands/init.ts';
import { GAP_WIDTH, KIND_ROWS, DETECTION_LABEL_WIDTH } from '#cli/config/commands/init.ts';

const GAP = ' '.repeat(GAP_WIDTH);
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Ten detection rows share this shape; one owner keeps the column layout.
function row(label: string, items: string[]): string | undefined {
    return items.length === 0 ? undefined : `${label.padEnd(DETECTION_LABEL_WIDTH)} ${items.join(GAP)}`;
}

function scopesRow(summary: DetectionSummary): string | undefined {
    const paths = summary.scopes.filter((scope) => scope.path !== '').map((scope) => scope.path);
    if (summary.scopes.length <= 1) return row('scopes', paths);
    const sources = new Set(summary.scopes.filter((scope) => scope.path !== '').map((scope) => scope.source));
    let note = 'from gspot.toml';
    if (sources.has('project'))
        note = sources.has('workspace')
            ? 'a project file or a workspace declaration in each'
            : 'a project file in each';
    else if (sources.has('workspace')) note = 'from workspace declarations';
    return row('scopes', [...paths, note]);
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

function ownershipRows(summary: DetectionSummary): string[] {
    const lines: string[] = [];
    if (summary.owned.length > 0) lines.push(`already configured   ${summary.owned.join('  ')}`);
    if (summary.unowned.length > 0) lines.push(`no gspot configuration      ${summary.unowned.join('  ')}`);
    if (lines.length > 0) lines.push('');
    return lines;
}

/**
 * The detection header: tracked files, what each kit kind was found from, scopes, tooling, and what has no configuration.
 * @param summary what init detected
 * @returns the text, ending with a blank line when tooling was found
 */
export function detectionText(summary: DetectionSummary): string {
    const languages = summary.plans
        .filter((plan) => plan.kind === 'language' && summary.manifests.get(plan.configuration)?.kit.default !== true)
        .map((plan) => `${plan.configuration} ${plan.evidence.split(' ', 1)[0] ?? ''}`);
    const rows = [
        row('languages', languages),
        ...KIND_ROWS.map(({ label, kind }) =>
            row(
                label,
                summary.plans
                    .filter(
                        (plan) => plan.kind === kind && summary.manifests.get(plan.configuration)?.kit.default !== true,
                    )
                    .map((plan) => `${plan.configuration}  ${plan.evidence}`),
            ),
        ),
        scopesRow(summary),
        ...toolingRows(summary),
    ].filter((line) => line !== undefined);
    return [
        `reading ${summary.files.length.toLocaleString('en-US')} tracked files`,
        ...(summary.hasGit
            ? []
            : ['no git repository: the hooks and the configurations that read git stay out until git init runs']),
        '',
        ...rows,
        ...summary.unknown.map(
            (entry) =>
                `${'no configuration'.padEnd(DETECTION_LABEL_WIDTH)} ${entry.language}: ${String(entry.count)} files unchecked`,
        ),
        '',
        ...ownershipRows(summary),
    ].join('\n');
}
