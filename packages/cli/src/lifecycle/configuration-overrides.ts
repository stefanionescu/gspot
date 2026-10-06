import { selectForInit } from '#cli/lifecycle/selection.ts';
import type { Log } from '#cli/types/lifecycle/ownership.ts';
import type { Session } from '#cli/types/execution/session.ts';

import type {
    InitInputs,
    InitSelection,
    SelectionUpdate,
    ConfigurationSelections,
} from '#cli/types/lifecycle/selection.ts';

/**
 * Retain manual language and framework additions and removals across repository detection changes.
 * @param input current choices, configuration kinds, and the last applied selection
 * @returns the override history with the current choices as its baseline
 */
export function updateConfigurationOverrides(input: SelectionUpdate): ConfigurationSelections {
    const { choices, manifests, previous = {} } = input;
    return Object.fromEntries(
        choices.entries().map(([path, ids]) => {
            const configurations = ids.filter((id) => {
                const kind = manifests.get(id)?.configuration.kind;
                return kind === 'language' || kind === 'framework';
            });
            const recorded = Object.hasOwn(previous, path) ? previous[path] : undefined;
            const before = recorded?.configurations ?? [];
            const added = [
                ...new Set([
                    ...(recorded?.added ?? []).filter((id) => !before.includes(id) || configurations.includes(id)),
                    ...configurations.filter((id) => !before.includes(id)),
                ]),
            ];
            const removed = [
                ...new Set([
                    ...(recorded?.removed ?? []).filter((id) => !configurations.includes(id)),
                    ...before.filter((id) => !configurations.includes(id)),
                ]),
            ];
            return [path, { configurations, added, removed }];
        }),
    );
}

/**
 * Record authored edits before generated writes so an interrupted apply retains those edits.
 * @param session the policy being written
 * @param log the locked ownership log
 */
export function recordConfigurationOverrides(session: Session, log: Log): void {
    const { policy } = session.policyFiles;
    const selections = updateConfigurationOverrides({
        choices: new Map([
            ['', policy.configurations],
            ...policy.scopes.map((scope): [string, string[]] => [scope.path, scope.configurations]),
        ]),
        manifests: session.manifests,
        previous: log.state.selections,
    });
    log.state.selections = selections;
    log.save();
}

/**
 * Separate initialization's detected choices from its explicit language and framework overrides.
 * @param inputs repository facts and initialization options
 * @param selection the plan the developer accepted
 * @returns the private history for later reconciliation
 */
export function prepareConfigurationOverrides(inputs: InitInputs, selection: InitSelection): ConfigurationSelections {
    const { options, manifests, root } = inputs;
    const automatic = selectForInit({
        ...inputs,
        workspace: selection.scopes.filter((scope) => scope.path !== ''),
        options: { cwd: root, yes: true, isDryRun: true, install: false },
    });
    const previous = updateConfigurationOverrides({
        choices: new Map([['', automatic.rootIds], ...automatic.scopeConfigurations]),
        manifests,
        previous: {},
    });
    const namedScopes = new Set((options.scopes ?? []).map((flag) => flag.split('=', 1)[0]?.replace(/\/$/u, '')));
    for (const [path, entry] of Object.entries(previous)) {
        const isManual = path === '' ? options.configurations !== undefined : namedScopes.has(path);
        entry.added = isManual
            ? entry.configurations.filter((id) =>
                  (path === ''
                      ? (options.configurations ?? [])
                      : (selection.scopeConfigurations.get(path) ?? [])
                  ).includes(id),
              )
            : [];
    }
    return updateConfigurationOverrides({
        choices: new Map([['', selection.rootIds], ...selection.scopeConfigurations]),
        manifests,
        previous,
    });
}
