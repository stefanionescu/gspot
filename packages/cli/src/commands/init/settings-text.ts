import { posix } from 'node:path';
import { setKey } from '#cli/settings/edit.ts';
import { readGitSetting } from '#cli/system/git.ts';
import { findScope } from '#cli/repository/scopes.ts';
import { findText } from '#cli/system/files/reads.ts';
import { PBXPROJ } from '#cli/config/parsers/xcode.ts';
import { stripUndefined } from '#cli/system/values.ts';
import { parseBuildSettings } from '#cli/parsers/xcode.ts';
import { selectForScope } from '#cli/repository/coverage.ts';
import { type Manifest } from '#cli/types/configurations.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { CI_FILE_LABELS } from '#cli/config/generation/ci.ts';
import { ORIGIN_URL_SETTING } from '#cli/config/system/git.ts';
import { readFormatTables } from '#cli/commands/init/format.ts';
import { readLintJobs } from '#cli/repository/existing-tools.ts';
import { formatSettingsText } from '#cli/settings/write/text.ts';
import { buildFilenameMatcher } from '#cli/repository/matchers.ts';
import { buildDraftSelection } from '#cli/commands/init/selection.ts';
import { XCODE_DESTINATIONS } from '#cli/config/settings/defaults.ts';
import { buildImportStyleTables } from '#cli/commands/init/import-style.ts';
import { type Repository, type ExistingTools } from '#cli/types/repository/inventory.ts';
import { SWIFT_CONFIGURATION, OPENAPI_CONFIGURATION } from '#cli/config/configurations.ts';
import { PREFACE_BODY, REMOTE_URL_USER, REMOTE_URL_SCHEME } from '#cli/config/commands/init.ts';
import { GITLAB_CI_FILE, GITHUB_WORKFLOWS_FOLDER } from '#cli/config/repository/existing-tools.ts';

import {
    type InitAnswers,
    type InitOptions,
    type InitSelection,
    type SettingsDraft,
} from '#cli/types/commands/init.ts';

function buildOpenapiTables(
    selections: { scope: string; selected: Manifest[] }[],
    draft: SettingsDraft,
    repository: Repository,
): Map<string, TomlTable> {
    const openapiSelections = selections
        .map(({ scope, selected }) => ({
            scope,
            openapi: selected.find((entry) => entry.configuration.name === OPENAPI_CONFIGURATION),
        }))
        .filter((entry): entry is typeof entry & { openapi: Manifest } => entry.openapi !== undefined);
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
 *
 * @param repositoryRoot the folder whose origin remote gives the host when no CI files exist.
 * @param existingTools the tool and CI files that init found.
 * @returns the provider to propose, or none when the repository needs no workflow.
 */
function detectCiProvider(repositoryRoot: string, existingTools: ExistingTools): InitAnswers['ci'] {
    if (readLintJobs(repositoryRoot, existingTools.ci).length > 0) return 'none';
    let existing: InitAnswers['ci'] | undefined;
    if (existingTools.ci.includes(GITLAB_CI_FILE)) existing = 'gitlab';
    else if (existingTools.ci.some((path) => path.startsWith(GITHUB_WORKFLOWS_FOLDER))) existing = 'github';
    if (existing !== undefined) return existing;
    const remote = readGitSetting(repositoryRoot, ORIGIN_URL_SETTING) ?? '';
    const host = remote.replace(REMOTE_URL_SCHEME, '').replace(REMOTE_URL_USER, '');
    return (
        (Object.keys(CI_FILE_LABELS) as (keyof typeof CI_FILE_LABELS)[]).find(
            (provider) => host.startsWith(`${provider}.com:`) || host.startsWith(`${provider}.com/`),
        ) ?? 'none'
    );
}

// Swift seeds come from the Xcode project owned by each selected scope.
function buildSwiftTables(
    selections: { scope: string; selected: Manifest[] }[],
    draft: SettingsDraft,
    repository: Repository,
): Map<string, TomlTable> {
    const projectFiles = repository.files.filter((entry) => entry.path.endsWith(PBXPROJ));
    const swiftFiles = selections.flatMap(({ scope, selected }) => {
        if (!selected.some((entry) => entry.configuration.name === SWIFT_CONFIGURATION)) return [];
        const file = projectFiles.find((entry) => findScope(entry.path, draft.scopes).path === scope)?.path;
        return file === undefined ? [] : [{ scope, file }];
    });
    return new Map(
        swiftFiles.map(({ scope, file }) => {
            const text = findText(repository.root, file);
            const sdkRoot = text === undefined ? undefined : parseBuildSettings(text).sdkRoot;
            const destination = XCODE_DESTINATIONS.get(sdkRoot);
            const swiftSettings = {
                xcode_project: posix.dirname(file),
                ...stripUndefined({ xcode_destination: destination }),
            };
            return [scope, { swift: swiftSettings }];
        }),
    );
}

function buildHeadTables(draft: SettingsDraft, repository: Repository, manifests: Map<string, Manifest>): TomlTable {
    const selection = buildDraftSelection(draft);
    const scopes = ['', ...draft.scopes.map((entry) => entry.path)];
    const selections = scopes.map((scope) => ({ scope, selected: selectForScope(selection, scope, manifests) }));
    const projects = buildSwiftTables(selections, draft, repository);
    const formats = readFormatTables(draft, repository, manifests);
    const openapiTables = buildOpenapiTables(selections, draft, repository);
    const importStyles = buildImportStyleTables(selections, repository);
    const tables = new Map(
        scopes.map((scope) => [
            scope,
            { ...projects.get(scope), ...openapiTables.get(scope), ...formats.get(scope), ...importStyles.get(scope) },
        ]),
    );
    const scope = draft.scopes.map(({ path, configurations }) => ({ path, configurations, ...tables.get(path) }));
    return {
        ...(draft.level === undefined ? {} : { level: draft.level }),
        configurations: draft.configurations,
        ...tables.get(''),
        ...stripUndefined({ scope: scope.length === 0 ? undefined : scope }),
    };
}

/**
 * Build the gspot.toml text for a settings draft.
 *
 * @param draft the settings choices.
 * @param repository the tracked source files.
 * @param manifests the configurations to choose from.
 * @returns TOML with its schema line and preface.
 */
function buildInitSettings(draft: SettingsDraft, repository: Repository, manifests: Map<string, Manifest>): string {
    const document = buildHeadTables(draft, repository, manifests);
    if (draft.hooks) setKey(document, 'hooks.enabled', true);
    else Reflect.deleteProperty(document, 'hooks');
    if (draft.ci === 'none') {
        Reflect.deleteProperty(document, 'ci');
    } else {
        setKey(document, 'ci.enabled', true);
        setKey(document, 'ci.provider', draft.ci);
    }
    if (!draft.rules) setKey(document, 'rules.enabled', false);
    return formatSettingsText(PREFACE_BODY, document);
}

/**
 * Draft the settings from the configuration choices and the init answers.
 *
 * @param selection the configurations and scopes.
 * @param answers the integration choices.
 * @param options the authored level, when selected.
 * @returns the root and scope choices: the answers and the inferred commit scopes.
 */
function buildSettingsDraft(
    selection: InitSelection,
    answers: InitAnswers,
    options: Pick<InitOptions, 'level'>,
): SettingsDraft {
    const scopes = selection.scopes.filter((scope) => scope.path !== '');
    return {
        configurations: selection.rootIds,
        scopes: scopes.map((scope) => ({
            ...scope,
            configurations: selection.scopeConfigurations.get(scope.path) ?? [],
        })),
        ...answers,
        ...stripUndefined({ level: options.level }),
    };
}

export { detectCiProvider, buildInitSettings, buildSettingsDraft };
