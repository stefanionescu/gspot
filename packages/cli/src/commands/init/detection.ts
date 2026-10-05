// The header init prints: what it found in the repository, one row per kind.
import type { DetectionSummary } from '#cli/types/commands/init.ts';
import { CONFIGURATION_LABELS } from '#cli/config/configurations.ts';
import { DETECTION_GAP, DETECTION_LABEL_WIDTH } from '#cli/config/commands/init.ts';

function row(label: string, items: string[]): string | undefined {
    return items.length === 0 ? undefined : `${label.padEnd(DETECTION_LABEL_WIDTH)} ${items.join(DETECTION_GAP)}`;
}

function scopesRow(summary: DetectionSummary): string | undefined {
    const paths = summary.scopes.filter((scope) => scope.path !== '').map((scope) => scope.path);
    if (summary.scopes.length <= 1) return row('scopes', paths);
    const sources = new Set(summary.scopes.filter((scope) => scope.path !== '').map((scope) => scope.source));
    let note = 'from gspot.toml';
    if (sources.has('project')) note = 'a project file in each';
    if (sources.has('flag')) note = 'from --scope-configurations';
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
    const lines = [row('gspot replaces', summary.owned), row('no configuration for', summary.unowned)].filter(
        (line) => line !== undefined,
    );
    return lines.length === 0 ? [] : [...lines, ''];
}

/**
 * The detection header: tracked files, what each configuration kind was found from, scopes, and tooling.
 * @param summary what init detected
 * @returns the text, ending with a blank line when tooling was found
 */
export function detectionText(summary: DetectionSummary): string {
    const languages = summary.detected
        .filter(
            (evidence) =>
                evidence.kind === 'language' &&
                summary.manifests.get(evidence.configuration)?.configuration.always_selected !== true,
        )
        .map((evidence) => `${evidence.configuration} ${evidence.evidence.split(' ', 1)[0] ?? ''}`);
    const rows = [
        row(CONFIGURATION_LABELS.language.toLowerCase(), languages),
        ...Object.entries(CONFIGURATION_LABELS)
            .filter(([kind]) => kind !== 'language' && kind !== 'general')
            .map(([kind, label]) =>
                row(
                    label.toLowerCase(),
                    summary.detected
                        .filter(
                            (evidence) =>
                                evidence.kind === kind &&
                                summary.manifests.get(evidence.configuration)?.configuration.always_selected !== true,
                        )
                        .map((evidence) => `${evidence.configuration}  ${evidence.evidence}`),
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
        '',
        ...ownershipRows(summary),
    ].join('\n');
}
