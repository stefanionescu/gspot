import { posix } from 'node:path';
import { setKey } from '#cli/settings/edit.ts';
import { scopeOf } from '#cli/repository/scopes.ts';
import { readGitSetting } from '#cli/system/git.ts';
import { emitSettings } from '#cli/settings/file.ts';
import { readText } from '#cli/system/files/reads.ts';
import { stripUndefined } from '#cli/system/values.ts';
import { detectedDefaults } from '#cli/settings/view.ts';
import { readLintJobs } from '#cli/repository/tooling.ts';
import { parseBuildSettings } from '#cli/parsers/xcode.ts';
import { selectForScope } from '#cli/repository/select.ts';
import { type Manifest } from '#cli/types/configurations.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { CI_FILE_LABELS } from '#cli/config/generation/ci.ts';
import { ORIGIN_URL_SETTING } from '#cli/config/system/git.ts';
import { filenameMatcher } from '#cli/repository/selectors.ts';
import { PBXPROJ, PBXPROJ_NAME } from '#cli/config/parsers/xcode.ts';
import { TEMPLATE_COMMENT_PREFIX } from '#cli/config/settings/file.ts';
import type { ConfigurationSelection } from '#cli/types/repository/selection.ts';
import { type Tooling, type Repository } from '#cli/types/repository/inventory.ts';
import { GITLAB_CI_FILE, GITHUB_WORKFLOWS_FOLDER } from '#cli/config/repository/tooling.ts';
import { PREFACE_BODY, REMOTE_URL_USER, REMOTE_URL_SCHEME } from '#cli/config/commands/init.ts';
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
            const matches = filenameMatcher(openapi.detect.filenames);
            const document = repository.files.find(
                (file) => matches(file.path) && scopeOf(file.path, draft.scopes).path === scope,
            );
            return document === undefined ? [] : [[scope, { openapi: { document: document.path } }] as const];
        }),
    );
}

/**
 * Choose the CI provider from existing files and the origin host.
 * @param root the repository root
 * @param tooling the discovered tool and CI files
 * @returns the provider to propose, or none when the repository needs no workflow
 */
function proposeCi(root: string, tooling: Tooling): InitAnswers['ci'] {
    if (readLintJobs(root, tooling.ci).length > 0) return 'none';
    let existing: InitAnswers['ci'] | undefined;
    if (tooling.ci.includes(GITLAB_CI_FILE)) existing = 'gitlab';
    else if (tooling.ci.some((path) => path.startsWith(GITHUB_WORKFLOWS_FOLDER))) existing = 'github';
    const remote = existing === undefined ? (readGitSetting(root, ORIGIN_URL_SETTING) ?? '') : '';
    const host = remote.replace(REMOTE_URL_SCHEME, '').replace(REMOTE_URL_USER, '');
    if (existing !== undefined) return existing;
    return (
        (Object.keys(CI_FILE_LABELS) as (keyof typeof CI_FILE_LABELS)[]).find(
            (provider) => host.startsWith(`${provider}.com:`) || host.startsWith(`${provider}.com/`),
        ) ?? 'none'
    );
}

function headTables(
    draft: SettingsDraft,
    repository: Repository,
    manifests: Map<string, Manifest>,
    formats: Map<string, TomlTable>,
): TomlTable {
    const selection = draftSelection(draft);
    const swift = draft.template?.tables.xcode;
    const projectFiles = repository.files.filter((entry) => entry.path.endsWith(PBXPROJ));
    const scopes = ['', ...draft.scopes.map((entry) => entry.path)];
    const selections = scopes.map((scope) => ({ scope, selected: selectForScope(selection, scope, manifests) }));
    const swiftFiles = selections.flatMap(({ scope, selected }) => {
        if (swift?.destination !== undefined || !selected.some((entry) => entry.configuration.name === 'swift'))
            return [];
        const file =
            swift?.project === undefined
                ? projectFiles.find((entry) => scopeOf(entry.path, draft.scopes).path === scope)?.path
                : posix.join(swift.project, PBXPROJ_NAME);
        return file === undefined ? [] : [{ scope, file }];
    });
    const projects = new Map(
        swiftFiles.map(({ scope, file }) => {
            const text = readText(repository.root, file);
            const sdkRoot = text === undefined ? undefined : parseBuildSettings(text).sdkRoot;
            const destination = detectedDefaults(sdkRoot === undefined ? {} : { sdkRoot }).get('xcode.destination');
            const xcode = {
                ...(scope === '' ? swift : {}),
                project: posix.dirname(file),
                ...stripUndefined({ destination }),
            };
            return [scope, { xcode }];
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
 * The gspot.toml text for a settings draft.
 * @param draft settings choices
 * @param repository tracked source files
 * @param manifests available configurations
 * @param formats formatting values for each scope
 * @returns TOML with its schema line and preface
 */
function initSettingsText(
    draft: SettingsDraft,
    repository: Repository,
    manifests: Map<string, Manifest>,
    formats: Map<string, TomlTable>,
): string {
    const document = headTables(draft, repository, manifests, formats);
    if (draft.commitScopes !== undefined) setKey(document, 'tools.commitlint.scopes', draft.commitScopes);
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
    return emitSettings(previous + (draft.template?.text ?? ''), document);
}

/**
 * Drafts the repository settings from configuration choices and initialization answers.
 * @param selection the selected configurations and scopes
 * @param answers the integration choices
 * @returns the settings draft
 */
function draftSettings(selection: InitSelection, answers: InitAnswers): SettingsDraft {
    const scopes = selection.scopes.filter((scope) => scope.path !== '');
    const commitScopes =
        scopes.length > 0 && selection.selectedIds.has('commits')
            ? (detectedDefaults({ scopes: scopes.map((scope) => posix.basename(scope.path)) }).get(
                  'tools.commitlint.scopes',
              ) as string[])
            : undefined;
    return {
        configurations: selection.rootIds,
        scopes: scopes.map((scope) => ({
            ...scope,
            configurations: selection.scopeConfigurations.get(scope.path) ?? [],
        })),
        ...answers,
        ...(commitScopes === undefined ? {} : { commitScopes }),
    };
}

/**
 * Read the selected configurations from the draft.
 * @param draft the configuration choices and template
 * @returns the root and scope configuration choices
 */
function draftSelection(draft: SettingsDraft): ConfigurationSelection {
    return {
        configurations: draft.configurations,
        removed_configurations: [],
        scope: Object.fromEntries(draft.scopes.map((scope) => [scope.path, { ...scope, removed_configurations: [] }])),
    };
}

export { proposeCi, draftSettings, draftSelection, initSettingsText };
