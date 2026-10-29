import { DIGITS_ONLY } from '#cli/config/text.ts';
import { extractExtension } from '#cli/system/paths.ts';
import { GROUP_LABELS } from '#cli/config/configurations/names.ts';
import type { DetectionSummary } from '#cli/types/commands/init.ts';
import { buildFileMatcher } from '#cli/repository/files/selection.ts';

import {
    CI_LABEL,
    OWN_HOOKS,
    HOOKS_LABEL,
    LEAVES_LABEL,
    ANY_FILE_GLOB,
    REPLACES_LABEL,
    NO_GIT_MESSAGE,
    PROJECT_FILE_NOTE,
    AGENT_FILES_LABEL,
    NOT_CHECKED_LABEL,
    LINT_FOLDERS_LABEL,
    LINT_SETUP_MESSAGE,
    DETECTION_GAP_WIDTH,
    UNCHECKED_FILES_SHOWN,
    DETECTION_LABEL_WIDTH,
} from '#cli/config/commands/init/detection.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 10 calls in this file share it.
function formatDetectionRow(label: string, names: string[]): string | undefined {
    return names.length === 0
        ? undefined
        : `${label.padEnd(DETECTION_LABEL_WIDTH)} ${names.join(' '.repeat(DETECTION_GAP_WIDTH))}`;
}

function formatDetectedScopes(summary: DetectionSummary): string | undefined {
    const paths = summary.scopes.filter((scope) => scope.path !== '').map((scope) => scope.path);
    if (summary.scopes.length <= 1) return formatDetectionRow('scopes', paths);
    const sources = new Set(summary.scopes.filter((scope) => scope.path !== '').map((scope) => scope.origin));
    let note = 'from gspot.toml';
    if (sources.has('project')) note = PROJECT_FILE_NOTE;
    return formatDetectionRow('scopes', [...paths, note]);
}

function formatDetectedTools(summary: DetectionSummary): (string | undefined)[] {
    const { repositorySetup } = summary;
    const hooks = repositorySetup.hooks.map(
        (hook) => `${hook.path}/  ${hook.files.join(', ')} (${hook.kind === 'husky' ? 'husky' : OWN_HOOKS})`,
    );
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
    const matchers = summary.configurationsByName
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

function formatConflictingConfigFiles(summary: DetectionSummary): string[] {
    const lines = [
        formatDetectionRow(REPLACES_LABEL, summary.owned),
        formatDetectionRow(LEAVES_LABEL, summary.unowned),
    ].filter((line) => line !== undefined);
    return lines.length === 0 ? [] : [...lines, ''];
}

/**
Format the detection header: tracked files, the evidence for each group, scopes, and existing tools.

@param summary what init detected.
@returns the text, with a final blank line when the repository has existing tools.
*/
export function formatDetection(summary: DetectionSummary): string {
    const detected = summary.detected.filter(
        (evidence) => summary.configurationsByName.get(evidence.configuration)?.always_selected !== true,
    );
    const languages = detected
        .filter((evidence) => evidence.group === 'language')
        .map((evidence) => {
            const count = evidence.evidence.split(' ', 1)[0] ?? '';
            return DIGITS_ONLY.test(count)
                ? `${evidence.configuration} ${count}`
                : `${evidence.configuration} (${evidence.evidence})`;
        });
    const rows = [
        formatDetectionRow(GROUP_LABELS.language.toLowerCase(), languages),
        ...formatUncheckedFiles(summary),
        ...Object.entries(GROUP_LABELS)
            .filter(([group]) => group !== 'language' && group !== 'general')
            .map(([group, label]) =>
                formatDetectionRow(
                    label.toLowerCase(),
                    detected
                        .filter((evidence) => evidence.group === group)
                        .map((evidence) => `${evidence.configuration}  ${evidence.evidence}`),
                ),
            ),
        formatDetectedScopes(summary),
        ...formatDetectedTools(summary),
    ].filter((line) => line !== undefined);
    return [
        `reading ${summary.files.length.toLocaleString('en-US')} ${summary.files.length === 1 ? 'file' : 'files'}: tracked, and untracked but not ignored`,
        ...(summary.hasGit ? [] : [NO_GIT_MESSAGE]),
        '',
        ...rows,
        '',
        ...formatConflictingConfigFiles(summary),
    ].join('\n');
}
