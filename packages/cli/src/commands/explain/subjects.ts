// Explain a check, tool rule, configuration, setting, or file path.
import { nearMatches } from '#cli/policy/near.ts';
import * as messages from '#cli/policy/messages.ts';
import type { Session } from '#cli/execution/session.ts';
import { quoteArgument } from '#cli/platform/arguments.ts';
import { explainPath } from '#cli/commands/explain/file.ts';
import type { ResolvedSetting } from '#cli/policy/settings.ts';
import { settingValue, specFor } from '#cli/policy/settings.ts';
import type { ListingRow } from '#cli/configurations/listing.ts';
import type { SettingSpec } from '#cli/configurations/schema.ts';
import { allChecks, toRow } from '#cli/configurations/listing.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { checkExplanation, toolRuleExplanation } from '#cli/commands/explain/checks.ts';

const STAGES = ['commit', 'push', 'manual', 'message'];
const DIRECTIONS: Record<string, string> = {
    ceiling: 'a ceiling: raising it needs a reason',
    floor: 'a floor: lowering it needs a reason',
    loosening: 'a loosening: setting it needs a reason',
    tightening: 'a tightening: no reason needed',
    neutral: 'neutral: no reason needed',
    'per-rule': 'per rule: options and rules turned on; off is an ignore',
};

function listLine(label: string, items: string[]): string[] {
    return items.length === 0 ? [] : [`${label}: ${items.join(', ')}`];
}

function stageLines(row: ListingRow): string[] {
    return STAGES.flatMap((stage) =>
        listLine(
            `Checks at ${stage}`,
            row.checks.filter((check) => check.stage === stage).map((check) => check.check),
        ),
    );
}

function configurationExplanation(configurationName: string): Explanation | { error: string } {
    const manifest = configurationManifests().get(configurationName);
    if (!manifest)
        return {
            error: messages.unknownConfiguration(
                configurationName,
                nearMatches(configurationName, configurationManifests().keys().toArray()),
            ),
        };
    const row = toRow(manifest);
    const { detect, claims } = manifest;
    const lines = [
        `${row.title} (${row.kind} configuration)`,
        '',
        row.description,
        '',
        ...listLine('Detected by', [
            ...detect.extensions,
            ...detect.filenames,
            ...detect.dependencies.map((name) => `${name} in dependencies`),
        ]),
        ...listLine('Claims', [...claims.extensions, ...claims.filenames, ...claims.paths]),
        ...(claims.from_languages ? ['Claims: every file a language configuration claims'] : []),
        ...listLine('Requires', row.requires),
        ...listLine('Tools it pins', row.tools),
        ...stageLines(row),
        ...listLine('Settings', row.settings),
        ...listLine('Rule files', row.rules),
    ];
    return { kind: 'configuration', subject: configurationName, text: `${lines.join('\n')}\n`, data: row };
}

function changeLine(spec: SettingSpec, key: string, scope: string): string {
    const isReasoned = ['ceiling', 'floor', 'loosening'].includes(spec.direction);
    return `Change it: gspot set ${quoteArgument(key)} <value>${scope}${isReasoned ? ' --reason "..."' : ''}`;
}

type SettingScope = { scope: string; shipped: unknown; current: ResolvedSetting | undefined };

// The lines that say what a setting holds in a scope now, and where the value came from.
function valueLines(shipped: unknown, current: ResolvedSetting | undefined): string[] {
    return [
        `Shipped default: ${shipped === undefined ? 'none' : JSON.stringify(shipped)}`,
        `Current value: ${JSON.stringify(current?.value)} (from ${current?.source ?? 'unset'})`,
        ...(current?.reason === undefined ? [] : [`Reason on record: ${current.reason}`]),
    ];
}

// The lines about one scope: its default, its current value and source, and how to change it.
function scopeLines(key: string, spec: SettingSpec, entry: SettingScope): string[] {
    const { scope, shipped, current } = entry;
    const target = scope === '' ? '' : ` --scope ${quoteArgument(scope)}`;
    return [
        '',
        `Scope: ${scope === '' ? 'root' : scope}`,
        ...valueLines(shipped, current),
        changeLine(spec, key, target),
        `Back to the default: gspot set ${quoteArgument(key)} --default${target}`,
    ];
}

function settingLines(key: string, spec: SettingSpec, scopes: SettingScope[]): string[] {
    return [
        key,
        '',
        spec.summary,
        '',
        `Direction: ${DIRECTIONS[spec.direction] ?? spec.direction}`,
        ...scopes.flatMap((entry) => scopeLines(key, spec, entry)),
    ];
}

function settingExplanation(session: Session | undefined, key: string): Explanation | undefined {
    if (session === undefined) return undefined;
    const scopes = session.scopes.flatMap((selection) => {
        const match = specFor(selection.surface, key);
        if (match === undefined) return [];
        return [
            {
                scope: selection.scope.path,
                spec: match.spec,
                current: settingValue(selection.surface, session.policyFiles.policy, key, selection.scope.path),
                shipped: selection.surface.defaults.get(match.spec.name)?.value,
            },
        ];
    });
    const first = scopes[0];
    if (first === undefined) return undefined;
    const lines = settingLines(key, first.spec, scopes);
    return {
        kind: 'setting',
        subject: key,
        text: `${lines.join('\n')}\n`,
        data: {
            key,
            ...first.spec,
            scopes: scopes.map(({ scope, shipped, current }) => ({
                scope,
                default: shipped,
                current: current?.value,
                source: current?.source,
                reason: current?.reason,
            })),
        },
    };
}

function explainSlashed(session: Session | undefined, subject: string): Explanation | { error: string } {
    const check = checkExplanation(session, subject);
    if (check) return check;
    const slash = subject.indexOf('/');
    const toolRule = toolRuleExplanation(session, subject.slice(0, slash), subject.slice(slash + 1));
    if (toolRule) return toolRule;
    const known = [...allChecks().keys(), ...(session?.policyFiles.policy.checks.map((check) => check.name) ?? [])];
    return { error: messages.unknownCheck(subject, nearMatches(subject, known)) };
}

function explainDotted(session: Session | undefined, subject: string): Explanation | { error: string } {
    const setting = settingExplanation(session, subject);
    if (setting) return setting;
    const known = [...new Set(session?.scopes.flatMap((scope) => [...scope.surface.specs.keys()]))];
    return { error: messages.settingNotExposed(subject, nearMatches(subject, known)) };
}

/**
 * Explains whatever the argument names, or returns the near matches.
 * @param session the session, or undefined outside a repository
 * @param subject a check name, a tool/rule pair, a configuration name, a setting key, or a file path
 * @returns the explanation, or an error naming the closest matches
 */
export function explain(session: Session | undefined, subject: string): Explanation | { error: string } {
    const file = explainPath(session, subject);
    if (file !== undefined && subject.startsWith('./')) return file;
    let named: Explanation | { error: string };
    if (subject.includes('/')) named = explainSlashed(session, subject);
    else if (subject.includes('.')) named = explainDotted(session, subject);
    else named = configurationExplanation(subject);
    if (!('error' in named)) return named;
    return file ?? named;
}

export type Explanation = {
    kind: 'check' | 'tool-rule' | 'configuration' | 'setting' | 'path';
    subject: string;
    text: string;
    data: Record<string, unknown>;
};
