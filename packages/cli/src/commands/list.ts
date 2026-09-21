import { Argument, type Command } from 'commander';
import { directoryOf } from '#cli/commands/flags.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { openSession } from '#cli/run/session.ts';
import { checkState } from '#cli/policy/check-state.ts';
import { detectPresets } from '#cli/presets/detect.ts';
import { everyManifest } from '#cli/presets/select.ts';
import { readManifests } from '#cli/repository/manifests.ts';
import { settingRows } from '#cli/policy/settings-list.ts';
import type { Session, CommandResult } from '#types/run.ts';

const KEY_GAP = 2;
const VALUE_WIDTH = 28;

function scopeTag(scope: string | undefined): string {
    return scope === undefined || scope === '' ? '' : `  [scope ${scope}]`;
}

function settingsText(session: Session): CommandResult {
    const { rows, extras } = settingRows(session);
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

function presetsResult(session: Session): CommandResult {
    const selected = everyManifest(session);
    const names = new Set(selected.map((manifest) => manifest.preset.name));
    const installed = selected.map((manifest) => ({
        name: manifest.preset.name,
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
    const facts = readManifests(session.root, session.repository.files);
    const detected = detectPresets(session.repository.files, session.manifests, facts)
        .filter((proposal) => !names.has(proposal.preset))
        .map((proposal) => ({
            name: proposal.preset,
            evidence: proposal.evidence,
            command: `gspot add ${proposal.preset}`,
        }));
    const detectedNames = new Set(detected.map((entry) => entry.name));
    const available = session.manifests
        .values()
        .filter((manifest) => !names.has(manifest.preset.name) && !detectedNames.has(manifest.preset.name))
        .map((manifest) => ({ name: manifest.preset.name, description: manifest.preset.description }))
        .toArray();
    const lines = ['installed'];
    for (const preset of installed) {
        lines.push(`  ${preset.name}`);
        for (const check of preset.checks) lines.push(`    ${check.name}  ${check.state}${scopeTag(check.scope)}`);
    }
    lines.push('', 'detected, not selected');
    for (const preset of detected) lines.push(`  ${preset.name}  ${preset.evidence}\n    ${preset.command}`);
    lines.push('', 'available');
    for (const preset of available) lines.push(`  ${preset.name}  ${preset.description}`);
    return { text: `${lines.join('\n')}\n`, json: { installed, detected, available }, exitCode: 0 };
}

/** List presets and effective settings without executing checks or mutating the project. */
export function registerList(program: Command): void {
    program
        .command('list')
        .description('List presets and check states, or effective settings and their sources')
        .addArgument(new Argument('[kind]', 'The information to list').choices(['settings']))
        .action(async (kind: string | undefined, _flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await printCommand(async () => {
                const session = await openSession(findRoot(directoryOf(global)));
                return kind === 'settings' ? settingsText(session) : presetsResult(session);
            }, global);
        });
}
