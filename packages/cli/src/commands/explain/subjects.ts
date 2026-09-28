// Explain a check, tool rule, configuration, setting, or file path.
import { allChecks } from '#cli/kits/listing.ts';
import { nearMatches } from '#cli/policy/near.ts';
import * as messages from '#cli/policy/messages.ts';
import { quoteArgument } from '#cli/platform/arguments.ts';
import { explainPath } from '#cli/commands/explain/file.ts';
import { configurationManifests } from '#cli/kits/manifests.ts';
import { specFor, settingValue } from '#cli/policy/settings.ts';
import type { Session } from '#cli/types/execution/execution.ts';
import type { ListingRow, SettingSpec } from '#cli/types/kits.ts';
import { STAGES, DIRECTIONS } from '#cli/config/commands/explain.ts';
import type { Explanation, SettingScope } from '#cli/types/commands/explain.ts';
import { checkExplanation, toolRuleExplanation } from '#cli/commands/explain/checks.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Seven rows of the subject listing share this shape; one owner keeps the label format.
function listLine(label: string, items: string[]): string[] {
    return items.length === 0 ? [] : [`${label}: ${items.join(', ')}`];
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
    const row: ListingRow = {
        name: manifest.kit.name,
        kind: manifest.kit.kind,
        title: manifest.kit.title,
        description: manifest.kit.description,
        requires: manifest.kit.requires,
        tools: manifest.tools.map((tool) => (tool.version === undefined ? tool.name : `${tool.name} ${tool.version}`)),
        checks: manifest.checks.map((check) => ({ check: check.name, stage: check.stage })),
        settings: manifest.settings.map((setting) => setting.name),
        rules: Object.values(manifest.guides)
            .flat()
            .map((entry) => entry.path),
        default: manifest.kit.default,
        proposed: manifest.kit.proposed,
    };
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
        ...STAGES.flatMap((stage) =>
            listLine(
                `Checks at ${stage}`,
                row.checks.filter((check) => check.stage === stage).map((check) => check.check),
            ),
        ),
        ...listLine('Settings', row.settings),
        ...listLine('Guides', row.rules),
    ];
    return { kind: 'configuration', subject: configurationName, text: `${lines.join('\n')}\n`, data: row };
}

// The lines about one scope: its default, its current value and source, and how to change it.
function scopeLines(key: string, spec: SettingSpec, entry: SettingScope): string[] {
    const { scope, shipped, current } = entry;
    const { value, source = 'unset', reason } = current ?? {};
    const target = scope === '' ? '' : ` --scope ${quoteArgument(scope)}`;
    const isReasoned = ['ceiling', 'floor', 'loosening'].includes(spec.direction);
    return [
        '',
        `Scope: ${scope === '' ? 'root' : scope}`,
        `Shipped default: ${shipped === undefined ? 'none' : JSON.stringify(shipped)}`,
        `Current value: ${JSON.stringify(value)} (from ${source})`,
        ...(reason === undefined ? [] : [`Reason on record: ${reason}`]),
        `Change it: gspot set ${quoteArgument(key)} <value>${target}${isReasoned ? ' --reason "..."' : ''}`,
        `Back to the default: gspot set ${quoteArgument(key)} --default${target}`,
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
    const lines = [
        key,
        '',
        first.spec.summary,
        '',
        `Direction: ${DIRECTIONS[first.spec.direction] ?? first.spec.direction}`,
        ...scopes.flatMap((entry) => scopeLines(key, first.spec, entry)),
    ];
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
 * @param session the session, or undefined outside a repository.
 * @param subject a check name, a tool/rule pair, a configuration name, a setting key, or a file path.
 * @returns the explanation, or an error naming the closest matches.
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
