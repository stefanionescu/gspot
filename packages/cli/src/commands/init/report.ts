import { extractExtension } from '#cli/system/paths.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import type { DetectionSummary } from '#cli/types/generation.ts';
import { buildFileMatcher } from '#cli/repository/files/selection.ts';

import {
    CI_LABEL,
    OWN_HOOKS,
    HOOKS_LABEL,
    GROUP_LABELS,
    LEAVES_LABEL,
    ANY_FILE_GLOB,
    REPLACES_LABEL,
    AGENT_FILES_LABEL,
    NOT_CHECKED_LABEL,
    PROJECT_FILE_NOTE,
    LINT_FOLDERS_LABEL,
    LINT_SETUP_MESSAGE,
    DETECTION_GAP_WIDTH,
    DETECTION_LABEL_WIDTH,
    UNCHECKED_FILES_SHOWN,
} from '#cli/config/commands/setup.ts';

function formatDetectionRow(label: string, names: string[]): string | undefined {
    return names.length === 0
        ? undefined
        : `${label.padEnd(DETECTION_LABEL_WIDTH)} ${names.join(' '.repeat(DETECTION_GAP_WIDTH))}`;
}

function formatDetectedScopes(summary: DetectionSummary): string | undefined {
    const paths = summary.scopes.filter((scope) => scope.path !== '').map((scope) => scope.path);
    if (summary.scopes.length <= 1) return formatDetectionRow('scopes', paths);
    return formatDetectionRow('scopes', [...paths, PROJECT_FILE_NOTE]);
}

function formatDetectedTools(summary: DetectionSummary): Array<string | undefined> {
    const { repositorySetup } = summary;
    const hooks = repositorySetup.hooks.map((hook) => {
        const location = hook.files.length === 0 ? hook.path : `${hook.path}/  ${hook.files.join(', ')}`;
        return `${location} (${hook.kind === 'husky' ? 'husky' : OWN_HOOKS})`;
    });
    const lint = repositorySetup.lintFolders.map((folder) => `${folder}/`);
    return [
        formatDetectionRow(HOOKS_LABEL, hooks.length === 0 ? ['none'] : hooks),
        formatDetectionRow(CI_LABEL, repositorySetup.ci.length === 0 ? ['none'] : repositorySetup.ci),
        formatDetectionRow(AGENT_FILES_LABEL, [
            ...repositorySetup.agentFiles,
            ...repositorySetup.ruleFolders.map((folder) => `${folder}/`),
        ]),
        formatDetectionRow(LINT_FOLDERS_LABEL, lint.length === 0 ? [] : [...lint, LINT_SETUP_MESSAGE]),
    ];
}

function formatUncheckedFiles(summary: DetectionSummary): string[] {
    const matchers = readConfigurations()
        .values()
        .flatMap((configuration) => [
            configuration.files,
            ...configuration.checks.flatMap((check) => check.files ?? []),
        ])
        .map((files) => buildFileMatcher({ ...files, paths: files.paths.filter((path) => !ANY_FILE_GLOB.test(path)) }))
        .toArray();
    const files = summary.files.filter((file) => file.kind === 'source' && matchers.every((matches) => !matches(file)));
    const extensions = [...new Set(files.map((file) => extractExtension(file.path)))].filter(
        (extension) => extension !== '',
    );
    return extensions.flatMap((extension) =>
        files
            .filter((file) => extractExtension(file.path) === extension)
            .slice(0, UNCHECKED_FILES_SHOWN)
            .map(
                (file) =>
                    formatDetectionRow(NOT_CHECKED_LABEL, [
                        `${file.path} (no configuration reads ${extension} files)`,
                    ]) as string,
            ),
    );
}

function formatConflictingConfigs(summary: DetectionSummary): string[] {
    const lines = [
        formatDetectionRow(REPLACES_LABEL, summary.owned),
        formatDetectionRow(LEAVES_LABEL, summary.unowned),
    ].filter((line) => line !== undefined);
    return lines.length === 0 ? [] : [...lines, ''];
}

export function formatDetection(summary: DetectionSummary): string {
    const detected = summary.detected.filter((evidence) => !evidence.configuration.always_selected);
    const languages = detected
        .filter((evidence) => evidence.configuration.group === 'language')
        .map((evidence) =>
            evidence.count === undefined
                ? `${evidence.configuration.name} (${evidence.evidence})`
                : `${evidence.configuration.name} ${String(evidence.count)}`,
        );
    const rows = [
        formatDetectionRow(GROUP_LABELS.language.toLowerCase(), languages),
        ...formatUncheckedFiles(summary),
        ...Object.entries(GROUP_LABELS)
            .filter(([group]) => group !== 'language' && group !== 'general')
            .map(([group, label]) =>
                formatDetectionRow(
                    label.toLowerCase(),
                    detected
                        .filter((evidence) => evidence.configuration.group === group)
                        .map((evidence) => `${evidence.configuration.name}  ${evidence.evidence}`),
                ),
            ),
        formatDetectedScopes(summary),
        ...formatDetectedTools(summary),
    ].filter((line) => line !== undefined);
    return [
        `reading ${summary.files.length.toLocaleString('en-US')} ${summary.files.length === 1 ? 'file' : 'files'}: tracked, and untracked but not ignored`,
        '',
        ...rows,
        '',
        ...formatConflictingConfigs(summary),
    ].join('\n');
}
