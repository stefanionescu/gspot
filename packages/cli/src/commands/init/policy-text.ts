import { posix } from 'node:path';
import { setKey } from '#cli/policy/edit.ts';
import { emitPolicy } from '#cli/policy/file.ts';
import { readText } from '#cli/platform/source.ts';
import { scopeOf } from '#cli/repository/scopes.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { projectBuildSettings } from '#cli/parsers/xcode.ts';
import type { TomlTable } from '#cli/types/policy/settings.ts';
import { selectForScope } from '#cli/configurations/select.ts';
import type { Repository } from '#cli/types/repository/inventory.ts';
import { XCODE_PROJECT_FILE } from '#cli/config/checks/tool/xcode.ts';
import type { InitSelection } from '#cli/types/lifecycle/selection.ts';
import type { InitAnswers, PolicyDraft } from '#cli/types/commands/init.ts';
import { PREFACE, SCHEMA_LINE, TEMPLATE_HEAD, XCODE_DESTINATIONS } from '#cli/config/commands/init.ts';

function headTables(draft: PolicyDraft, repository: Repository, manifests: Map<string, Manifest>): TomlTable {
    const selection = {
        configurations: draft.configurations,
        removed_configurations: [],
        scope: Object.fromEntries(draft.scopes.map((scope) => [scope.path, { ...scope, removed_configurations: [] }])),
    };
    const swift = draft.template?.tables.swift;
    const project = swift?.xcode_project;
    const destinations = new Map(
        swift?.xcode_destination === undefined && project !== ''
            ? ['', ...draft.scopes.map((entry) => entry.path)].flatMap((scope) => {
                  if (
                      !selectForScope(selection, scope, manifests).some((entry) => entry.configuration.name === 'swift')
                  )
                      return [];
                  const file =
                      project === undefined
                          ? repository.files.find(
                                (entry) =>
                                    entry.path.endsWith(XCODE_PROJECT_FILE) &&
                                    scopeOf(entry.path, draft.scopes).path === scope,
                            )?.path
                          : posix.join(project, 'project.pbxproj');
                  const text = file === undefined ? undefined : readText(repository.root, file);
                  const sdk = text === undefined ? undefined : projectBuildSettings(text).sdkRoot;
                  const destination = XCODE_DESTINATIONS.get(sdk);
                  return destination === undefined
                      ? []
                      : [
                            [
                                scope,
                                { swift: { ...(scope === '' ? swift : {}), xcode_destination: destination } },
                            ] as const,
                        ];
              })
            : [],
    );
    return {
        ...Object.fromEntries(
            (draft.template === undefined ? [] : Object.entries(draft.template.tables)).filter(
                ([key]) => !TEMPLATE_HEAD.has(key),
            ),
        ),
        configurations: draft.configurations,
        ...destinations.get(''),
        ...(draft.scopes.length === 0
            ? {}
            : {
                  scope: Object.fromEntries(
                      draft.scopes.map(({ path, configurations }) => [
                          path,
                          { configurations, ...destinations.get(path) },
                      ]),
                  ),
              }),
    };
}

// Writes the hooks, CI, agent rules, and runner tables from the answers.
function applyIntegrations(document: TomlTable, draft: PolicyDraft): void {
    for (const [key, value] of Object.entries({ hooks: draft.hooks, ci: draft.ci })) {
        if (value === false || value === 'none') Reflect.deleteProperty(document, key);
    }
    if (draft.hooks) setKey(document, 'hooks.enabled', true);
    if (draft.ci !== 'none') setKey(document, 'ci.provider', draft.ci);
    setKey(document, 'agent_rules.enabled', draft.rules);
    if (draft.runner === 'none') delete document['runner'];
    else document['runner'] = draft.runner;
}

/**
 * Drafts the repository policy from configuration choices and initialization answers.
 * @param selection the selected configurations and scopes
 * @param answers the integration choices
 * @returns the policy draft
 */
export function draftPolicy(selection: InitSelection, answers: InitAnswers): PolicyDraft {
    const scopes = selection.scopes.filter((scope) => scope.path !== '');
    const commitScopes =
        scopes.length > 0 && selection.selectedIds.has('commits')
            ? [...scopes.map((scope) => scope.name), 'root', 'hooks', 'deps']
            : undefined;
    return {
        configurations: selection.rootIds,
        scopes: scopes.map((scope) => ({
            ...scope,
            configurations: selection.scopeConfigurations.get(scope.path) ?? [],
        })),
        hooks: answers.hooks,
        ci: answers.ci,
        rules: answers.rules,
        runner: answers.runner,
        ...(commitScopes === undefined ? {} : { commitScopes }),
    };
}

/**
 * The gspot.toml text for a policy draft.
 * @param draft the policy choices
 * @param repository the tracked files and canonical source root
 * @param manifests the available configuration declarations
 * @returns the TOML text with the schema line and the preface
 */
export function proposeText(draft: PolicyDraft, repository: Repository, manifests: Map<string, Manifest>): string {
    const document = headTables(draft, repository, manifests);
    if (draft.commitScopes !== undefined && draft.commitScopes.length > 0)
        setKey(document, 'tools.commitlint.scopes', draft.commitScopes);
    applyIntegrations(document, draft);
    const copied =
        draft.template === undefined
            ? ''
            : `# Copied from template ${draft.template.tables.template}, sha256 ${draft.template.digest}.\n`;
    const previous = copied === '' ? PREFACE : `${SCHEMA_LINE}\n${copied}${PREFACE.slice(SCHEMA_LINE.length + 1)}`;
    return emitPolicy(previous + (draft.template?.text ?? ''), document);
}
