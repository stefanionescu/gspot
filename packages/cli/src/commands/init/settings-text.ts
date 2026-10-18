import { posix } from 'node:path';
import { setKey } from '#cli/settings/edit.ts';
import { readGitSetting } from '#cli/system/git.ts';
import { findScope } from '#cli/repository/scopes.ts';
import { readText } from '#cli/system/files/reads.ts';
import { stripUndefined } from '#cli/system/values.ts';
import { parseBuildSettings } from '#cli/parsers/xcode.ts';
import { selectForScope } from '#cli/repository/coverage.ts';
import { type Manifest } from '#cli/types/configurations.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { CI_FILE_LABELS } from '#cli/config/generation/ci.ts';
import { ORIGIN_URL_SETTING } from '#cli/config/system/git.ts';
import { readLintJobs } from '#cli/repository/existing-tools.ts';
import { formatSettingsText } from '#cli/settings/write/text.ts';
import { buildFilenameMatcher } from '#cli/repository/matchers.ts';
import { PBXPROJ, PBXPROJ_NAME } from '#cli/config/parsers/xcode.ts';
import { XCODE_DESTINATIONS } from '#cli/config/settings/defaults.ts';
import { TEMPLATE_COMMENT_PREFIX } from '#cli/config/settings/file.ts';
import type { ConfigurationSelection } from '#cli/types/repository/selection.ts';
import { type Repository, type ExistingTools } from '#cli/types/repository/inventory.ts';
import { PREFACE_BODY, REMOTE_URL_USER, REMOTE_URL_SCHEME } from '#cli/config/commands/init.ts';
import { GITLAB_CI_FILE, GITHUB_WORKFLOWS_FOLDER } from '#cli/config/repository/existing-tools.ts';
import { type InitAnswers, type InitSelection, type SettingsDraft } from '#cli/types/commands/init.ts';

function buildOpenapiTables(
    selections: { scope: string; selected: Manifest[] }[],
    draft: SettingsDraft,
    repository: Repository,
): Map<string, TomlTable> {
    const openapiSelections = selections
        .map(({ scope, selected }) => ({
            scope,
            openapi: selected.find((entry) => entry.configuration.name === 'openapi'),
        }))
        .filter(
            (entry): entry is typeof entry & { openapi: Manifest } =>
                entry.openapi !== undefined && draft.template?.tables.openapi?.document === undefined,
        );
    return new Map(
        openapiSelections.flatMap(({ scope, openapi }) => {
            const isDocument = buildFilenameMatcher(openapi.detect.filenames);
            const document = repository.files.find(
                (file) => findScope(file.path, draft.scopes).path === scope && isDocument(file.path),
            )?.path;
            return document === undefined ? [] : [[scope, { openapi: { document } }] as const];
        }),
    );
}

/**
 * Choose the CI provider from the existing files and the origin host.
 * @param repositoryRoot the folder whose origin remote gives the host when no CI files exist.
 * @param tooling the tool and CI files that init found.
 * @returns the provider to propose, or none when the repository needs no workflow.
 */
function detectCiProvider(repositoryRoot: string, tooling: ExistingTools): InitAnswers['ci'] {
    if (readLintJobs(repositoryRoot, tooling.ci).length > 0) return 'none';
    let existing: InitAnswers['ci'] | undefined;
    if (tooling.ci.includes(GITLAB_CI_FILE)) existing = 'gitlab';
    else if (tooling.ci.some((path) => path.startsWith(GITHUB_WORKFLOWS_FOLDER))) existing = 'github';
    const remote = existing === undefined ? (readGitSetting(repositoryRoot, ORIGIN_URL_SETTING) ?? '') : '';
    const host = remote.replace(REMOTE_URL_SCHEME, '').replace(REMOTE_URL_USER, '');
    if (existing !== undefined) return existing;
    return (
        (Object.keys(CI_FILE_LABELS) as (keyof typeof CI_FILE_LABELS)[]).find(
            (provider) => host.startsWith(`${provider}.com:`) || host.startsWith(`${provider}.com/`),
        ) ?? 'none'
    );
}

function buildHeadTables(
    draft: SettingsDraft,
    repository: Repository,
    manifests: Map<string, Manifest>,
    formats: Map<string, TomlTable>,
): TomlTable {
    const selection = buildDraftSelection(draft);
    const swift = draft.template?.tables.swift;
    const projectFiles = repository.files.filter((entry) => entry.path.endsWith(PBXPROJ));
    const scopes = ['', ...draft.scopes.map((entry) => entry.path)];
    const selections = scopes.map((scope) => ({ scope, selected: selectForScope(selection, scope, manifests) }));
    const swiftFiles = selections.flatMap(({ scope, selected }) => {
        if (swift?.xcode_destination !== undefined || !selected.some((entry) => entry.configuration.name === 'swift'))
            return [];
        const file =
            swift?.xcode_project === undefined
                ? projectFiles.find((entry) => findScope(entry.path, draft.scopes).path === scope)?.path
                : posix.join(swift.xcode_project, PBXPROJ_NAME);
        return file === undefined ? [] : [{ scope, file }];
    });
    const projects = new Map(
        swiftFiles.map(({ scope, file }) => {
            const text = readText(repository.root, file);
            const sdkRoot = text === undefined ? undefined : parseBuildSettings(text).sdkRoot;
            const destination = XCODE_DESTINATIONS.get(sdkRoot);
            const swiftSettings = {
                ...(scope === '' ? swift : {}),
                xcode_project: posix.dirname(file),
                ...stripUndefined({ xcode_destination: destination }),
            };
            return [scope, { swift: swiftSettings }];
        }),
    );
    const openapiTables = buildOpenapiTables(selections, draft, repository);
    const tables = new Map(
        scopes.map((scope) => [scope, { ...projects.get(scope), ...openapiTables.get(scope), ...formats.get(scope) }]),
    );
    const scope = draft.scopes.map(({ path, configurations }) => ({ path, configurations, ...tables.get(path) }));
    return {
        ...draft.template?.tables,
        configurations: draft.configurations,
        ...tables.get(''),
        ...stripUndefined({ scope: scope.length === 0 ? undefined : scope }),
    };
}

/**
 * Build the gspot.toml text for a settings draft.
 * @param draft the settings choices.
 * @param repository the tracked source files.
 * @param manifests the configurations to choose from.
 * @param formats the formatting values for each scope.
 * @returns TOML with its schema line and preface.
 */
function buildInitSettings(
    draft: SettingsDraft,
    repository: Repository,
    manifests: Map<string, Manifest>,
    formats: Map<string, TomlTable>,
): string {
    const document = buildHeadTables(draft, repository, manifests, formats);
    if (draft.hooks) setKey(document, 'hooks.enabled', true);
    else Reflect.deleteProperty(document, 'hooks');
    if (draft.ci === 'none') {
        Reflect.deleteProperty(document, 'ci');
    } else {
        setKey(document, 'ci.enabled', true);
        setKey(document, 'ci.provider', draft.ci);
    }
    if (!draft.rules) setKey(document, 'rules.enabled', false);
    const copied =
        draft.template === undefined
            ? ''
            : `${TEMPLATE_COMMENT_PREFIX}${draft.template.source}, sha256 ${draft.template.digest}.\n`;
    const previous = `${copied}${PREFACE_BODY}`;
    return formatSettingsText(previous + (draft.template?.text ?? ''), document);
}

/**
 * Draft the settings from the configuration choices and the init answers.
 * @param selection the configurations and scopes.
 * @param answers the integration choices.
 * @returns the root and scope choices: the answers and the inferred commit scopes.
 */
function buildSettingsDraft(selection: InitSelection, answers: InitAnswers): SettingsDraft {
    const scopes = selection.scopes.filter((scope) => scope.path !== '');
    return {
        configurations: selection.rootIds,
        scopes: scopes.map((scope) => ({
            ...scope,
            configurations: selection.scopeConfigurations.get(scope.path) ?? [],
        })),
        ...answers,
    };
}

/**
 * Read the configuration choices from the draft.
 * @param draft the choices and the template.
 * @returns the configuration choices for the root and each scope.
 */
function buildDraftSelection(draft: SettingsDraft): ConfigurationSelection {
    return {
        configurations: draft.configurations,
        removed_configurations: [],
        scopes: Object.fromEntries(draft.scopes.map((scope) => [scope.path, { ...scope, removed_configurations: [] }])),
    };
}

export { detectCiProvider, buildInitSettings, buildSettingsDraft, buildDraftSelection };
