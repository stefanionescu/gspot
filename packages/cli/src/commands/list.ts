import { resolve } from 'node:path';
import { findRoot } from '#cli/repository/root.ts';
import type { Session } from '#cli/types/planning.ts';
import { printResult } from '#cli/output/messages.ts';
import { Argument } from '@commander-js/extra-typings';
import { openSession } from '#cli/commands/session.ts';
import { selectionStatus } from '#cli/planning/skips.ts';
import type { CommandResult } from '#cli/types/output.ts';
import type { Program } from '#cli/types/commands/program.ts';
import { everyManifest } from '#cli/configurations/select.ts';
import { detectUnselected } from '#cli/configurations/detect.ts';
import { KEY_GAP, VALUE_WIDTH } from '#cli/config/commands/options.ts';
import { everyTable, listSettings } from '#cli/policy/settings/entries.ts';
import type { Policy, ScopeSelection } from '#cli/types/policy/settings.ts';
import type { ExtraRow, SettingsListing, SettingsListJson, ConfigurationsListJson } from '#cli/types/commands/list.ts';

function scopeTag(scope: string | undefined): string {
    return scope === undefined || scope === '' ? '' : `  [scope ${scope}]`;
}

function getExtras(scope: string, tools: Policy['tools']): ExtraRow[] {
    return Object.entries(tools).flatMap(([tool, table]) => {
        if (table.verbatim === undefined) return [];
        return [
            {
                tool,
                keys: Object.keys(table.verbatim).filter((key) => key !== 'reason'),
                ...(table.verbatim.reason === undefined ? {} : { reason: table.verbatim.reason }),
                scope,
            },
        ];
    });
}

function buildSettingsResult(session: Session): CommandResult {
    const { rows, extras } = buildSettingRows(session.policyFiles.policy, session.scopes);
    const displayed = rows.filter((row) => row.scope === '' || row.source.startsWith(`[[scope]] ${row.scope}`));
    const width = Math.max(...displayed.map((row) => row.key.length)) + KEY_GAP;
    const lines = displayed.map((row) => {
        const value = row.value === undefined ? 'unset' : JSON.stringify(row.value);
        const shortened = value.length > VALUE_WIDTH ? `${value.slice(0, VALUE_WIDTH - 1)}…` : value;
        return `${row.key.padEnd(width)}${shortened.padEnd(VALUE_WIDTH)} ${row.direction}  ${row.source}${scopeTag(row.scope)}`;
    });
    if (extras.length > 0) {
        lines.push('', 'extra tables gspot does not check');
        for (const verbatim of extras)
            lines.push(
                `  tools.${verbatim.tool}.verbatim  ${verbatim.keys.join(', ')}  ${verbatim.reason ?? ''}${scopeTag(verbatim.scope)}`,
            );
    }
    return { text: `${lines.join('\n')}\n`, json: { settings: rows, extras } satisfies SettingsListJson, exitCode: 0 };
}

function buildConfigurationsResult(session: Session): CommandResult {
    const manifests = everyManifest(session.scopes);
    const names = new Set(manifests.map((manifest) => manifest.configuration.name));
    const selected = manifests.map((manifest) => ({
        name: manifest.configuration.name,
        checks: session.scopes.flatMap((scope) =>
            scope.selected.includes(manifest)
                ? manifest.checks.map((spec) => ({
                      name: spec.name,
                      scope: scope.scope.path,
                      state: statusLabel(selectionStatus(session.policyFiles.policy, scope, spec)),
                  }))
                : [],
        ),
    }));
    const detected = detectUnselected(session.root, session.repository.files, session.manifests, manifests).map(
        ({ configuration, evidence, command }) => ({
            name: configuration,
            evidence,
            command,
        }),
    );
    const detectedNames = new Set(detected.map((entry) => entry.name));
    const available = session.manifests
        .values()
        .filter(
            (manifest) => !names.has(manifest.configuration.name) && !detectedNames.has(manifest.configuration.name),
        )
        .map((manifest) => ({ name: manifest.configuration.name, description: manifest.configuration.description }))
        .toArray();
    const lines = ['selected'];
    for (const configuration of selected) {
        lines.push(`  ${configuration.name}`);
        for (const [name, checks] of Map.groupBy(configuration.checks, (check) => check.name)) {
            const states = checks.map((check) => `${check.scope === '' ? 'root' : check.scope}: ${check.state}`);
            lines.push(`    ${name}  ${states.join(', ')}`);
        }
    }
    lines.push('', 'detected, not selected');
    for (const configuration of detected)
        lines.push(`  ${configuration.name}  ${configuration.evidence}\n    ${configuration.command}`);
    lines.push('', 'available');
    for (const configuration of available) lines.push(`  ${configuration.name}  ${configuration.description}`);
    return {
        text: `${lines.join('\n')}\n`,
        json: { selected, detected, available } satisfies ConfigurationsListJson,
        exitCode: 0,
    };
}

/**
 * Every setting per scope, plus each authored verbatim tool-options table.
 * @param policy the parsed repository policy
 * @param scopes the effective settings for each scope
 * @returns the rows and the verbatim tables
 */
function buildSettingRows(policy: Policy, scopes: ScopeSelection[]): SettingsListing {
    const extras = everyTable(policy).flatMap(({ table, scope = '' }) =>
        table.tools === undefined ? [] : getExtras(scope, table.tools),
    );
    const rows = scopes.flatMap((selection) => {
        const scope = selection.scope.path;
        return listSettings(selection.surface, policy, scope)
            .filter((entry) => scope === '' || !entry.source.startsWith('configuration'))
            .map((entry) => ({
                key: entry.key,
                value: entry.value,
                source: entry.source,
                direction: entry.spec.direction,
                scope,
            }));
    });
    return { rows, extras };
}

function statusLabel(status: ReturnType<typeof selectionStatus>): string {
    if (status === undefined) return 'on';
    return status.cause === 'setting' ? `waits for ${status.setting}` : `off (${status.cause})`;
}

/**
 * List configurations and effective settings without executing checks or mutating the project.
 * @param program the command-line program
 */
export function registerList(program: Program): void {
    program
        .command('list')
        .summary('List configurations, checks, and settings')
        .description(
            'List the selected, detected, and available configurations. Each check has one row with its state in each scope that selects its configuration. gspot list settings shows root values and the settings each scope changes. Long values are shortened; --json retains complete values and inherited settings. list changes nothing and runs no check.',
        )
        .addHelpText(
            'after',
            '\nExit codes:\n- 0: the list was printed.\n- 2: the input was invalid, or list could not finish.\n\nExample:\ngspot list settings',
        )
        .addArgument(
            new Argument('[kind]', 'List configurations or effective settings').choices(['configurations', 'settings']),
        )
        .action(async (kind, _flags, command) => {
            const global = command.optsWithGlobals();
            const cwd = resolve(global.C ?? process.cwd());

            const session = await openSession(findRoot(cwd));
            printResult(kind === 'settings' ? buildSettingsResult(session) : buildConfigurationsResult(session));
        });
}
