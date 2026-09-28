import { detectKits } from '#cli/kits/detect.ts';
import { Argument, type Command } from 'commander';
import { everyManifest } from '#cli/kits/select.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { listSettings } from '#cli/policy/settings.ts';
import { checkState } from '#cli/policy/check-state.ts';
import { coverageLines } from '#cli/output/coverage.ts';
import { openSession } from '#cli/execution/session.ts';
import { directoryOf } from '#cli/platform/arguments.ts';
import { coverageReport } from '#cli/execution/coverage.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import { readManifests } from '#cli/repository/manifests.ts';
import type { Session } from '#cli/types/execution/execution.ts';
import type { CommandResult } from '#cli/types/commands/commands.ts';
import { KEY_GAP, VALUE_WIDTH } from '#cli/config/commands/commands.ts';
import type { Policy, ExtraRow, ToolTables, ScopeSelection, SettingsListing } from '#cli/types/policy/policy.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Three rows print the scope tag; inlining it nests a template inside a template.
function scopeTag(scope: string | undefined): string {
    return scope === undefined || scope === '' ? '' : `  [scope ${scope}]`;
}

function extrasFor(scope: string, tools: ToolTables): ExtraRow[] {
    return Object.entries(tools).flatMap(([tool, table]) => {
        if (table.extra === undefined) return [];
        return [
            {
                tool,
                keys: Object.keys(table.extra).filter((key) => key !== 'reason'),
                ...(table.extra.reason === undefined ? {} : { reason: table.extra.reason }),
                scope,
            },
        ];
    });
}

function settingsText(session: Session): CommandResult {
    const { rows, extras } = settingRows(session.policyFiles.policy, session.scopes);
    const width = Math.max(...rows.map((row) => row.key.length)) + KEY_GAP;
    const lines = rows.map((row) => {
        const value = (row.value === undefined ? 'unset' : JSON.stringify(row.value)).padEnd(VALUE_WIDTH);
        return `${row.key.padEnd(width)}${value} ${row.direction}  ${row.source}${scopeTag(row.scope)}`;
    });
    if (extras.length > 0) {
        lines.push('', 'not a slot');
        for (const extra of extras)
            lines.push(
                `  tools.${extra.tool}.extra  ${extra.keys.join(', ')}  ${extra.reason ?? ''}${scopeTag(extra.scope)}`,
            );
    }
    return { text: `${lines.join('\n')}\n`, json: { settings: rows, extras }, exitCode: 0 };
}

function kitsResult(session: Session): CommandResult {
    const selected = everyManifest(session.scopes);
    const names = new Set(selected.map((manifest) => manifest.kit.name));
    const installed = selected.map((manifest) => ({
        name: manifest.kit.name,
        checks: session.scopes.flatMap((scope) =>
            scope.selected.includes(manifest)
                ? manifest.checks.map((spec) => ({
                      name: spec.name,
                      scope: scope.scope.path,
                      state: checkState(session.policyFiles.policy, scope, spec),
                  }))
                : [],
        ),
    }));
    const fields = readManifests(session.root, session.repository.files);
    const detected = detectKits(session.repository.files, session.manifests, fields)
        .filter((plan) => !names.has(plan.kit))
        .map((plan) => ({
            name: plan.kit,
            evidence: plan.evidence,
            command: `gspot add ${plan.kit}`,
        }));
    const detectedNames = new Set(detected.map((entry) => entry.name));
    const available = session.manifests
        .values()
        .filter((manifest) => !names.has(manifest.kit.name) && !detectedNames.has(manifest.kit.name))
        .map((manifest) => ({ name: manifest.kit.name, description: manifest.kit.description }))
        .toArray();
    const lines = ['installed'];
    for (const configuration of installed) {
        lines.push(`  ${configuration.name}`);
        for (const check of configuration.checks)
            lines.push(`    ${check.name}  ${check.state}${scopeTag(check.scope)}`);
    }
    lines.push('', 'detected, not selected');
    for (const configuration of detected)
        lines.push(`  ${configuration.name}  ${configuration.evidence}\n    ${configuration.command}`);
    lines.push('', 'available');
    for (const configuration of available) lines.push(`  ${configuration.name}  ${configuration.description}`);
    const coverage = coverageReport(session);
    lines.push('', ...coverageLines(coverage));
    return { text: `${lines.join('\n')}\n`, json: { installed, detected, available, coverage }, exitCode: 0 };
}

/**
 * Every setting per scope, plus every extra table under "not a slot."
 * @param policy the resolved policy
 * @param scopes the resolved settings for each scope
 * @returns the rows and the extra tables
 */
export function settingRows(policy: Policy, scopes: ScopeSelection[]): SettingsListing {
    const fromScopes = Object.entries(policy.scopeTables).flatMap(([scope, table]) =>
        table.tools === undefined ? [] : extrasFor(scope, table.tools),
    );
    const rows = scopes.flatMap((selection) => {
        const scope = selection.scope.path;
        return listSettings(selection.surface, policy, scope)
            .filter((entry) => scope === '' || !entry.source.startsWith('kit'))
            .map((entry) => ({
                key: entry.key,
                value: entry.value,
                source: entry.source,
                direction: entry.spec.direction,
                scope,
            }));
    });
    return { rows, extras: [...extrasFor('', policy.tools), ...fromScopes] };
}

/**
 * List configurations and effective settings without executing checks or mutating the project.
 * @param program the command-line program
 */
export function registerList(program: Command): void {
    program
        .command('list')
        .summary('List configurations and settings')
        .description('List configurations and check states, or effective settings and their sources')
        .addHelpText(
            'after',
            '\nEffects:\nReads the policy and repository to list selected, detected, and available configurations. With settings, prints effective values and their sources. It does not execute checks or mutate project files.\n\nExit codes:\n0: the requested information was printed. 2: invalid input or inability to complete the request.\n\nExample:\ngspot list settings',
        )
        .addArgument(new Argument('[kind]', 'The information to list').choices(['settings']))
        .action(async (kind: string | undefined, _flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await printCommand(async () => {
                const session = await openSession(findRoot(directoryOf(global)));
                return kind === 'settings' ? settingsText(session) : kitsResult(session);
            }, global);
        });
}
