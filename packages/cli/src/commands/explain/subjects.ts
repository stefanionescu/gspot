// Explain a check, tool rule, configuration, setting, or file path.
import { probeTool } from '#cli/tools/probe.ts';
import { nearMatches } from '#cli/policy/near.ts';
import * as messages from '#cli/policy/messages.ts';
import { runBlocking } from '#cli/platform/spawn.ts';
import type { Session } from '#cli/execution/session.ts';
import { quoteArgument } from '#cli/platform/arguments.ts';
import { explainPath } from '#cli/commands/explain/file.ts';
import type { ResolvedSetting } from '#cli/policy/settings.ts';
import type { ToolPin } from '#cli/configurations/manifests.ts';
import { settingValue, specFor } from '#cli/policy/settings.ts';
import type { ListingRow } from '#cli/configurations/listing.ts';
import { repositoryCheckSpec } from '#cli/policy/check-state.ts';
import { allChecks, toRow } from '#cli/configurations/listing.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import type { CheckSpec, SettingSpec } from '#cli/configurations/schema.ts';

const TOOL_TIMEOUT_MS = 10_000;
const SWIFTLINT_LINES = 6;
const STAGES = ['commit', 'push', 'manual', 'message'];
const DIRECTIONS: Record<string, string> = {
    ceiling: 'a ceiling: raising it needs a reason',
    floor: 'a floor: lowering it needs a reason',
    loosening: 'a loosening: setting it needs a reason',
    tightening: 'a tightening: no reason needed',
    neutral: 'neutral: no reason needed',
    'per-rule': 'per rule: options and rules turned on; off is an ignore',
};

const TOOL_RULE_SOURCES: Record<string, (rule: string, path: string) => string | undefined> = {
    ruff: (rule, path) => {
        const result = runBlocking([path, 'rule', rule, '--output-format', 'json'], {
            cwd: process.cwd(),
            timeoutMs: TOOL_TIMEOUT_MS,
        });
        if (result.code !== 0) return undefined;
        try {
            const parsed = JSON.parse(result.stdout) as { name?: string; summary?: string };
            return [parsed.name, parsed.summary].filter((part) => part !== undefined && part !== '').join(': ');
        } catch {
            return undefined;
        }
    },
    swiftlint: (rule, path) => {
        const result = runBlocking([path, 'rules', rule], { cwd: process.cwd(), timeoutMs: TOOL_TIMEOUT_MS });
        return result.code === 0 ? result.stdout.split('\n').slice(0, SWIFTLINT_LINES).join('\n').trim() : undefined;
    },
};

function pinNamed(name: string | undefined): ToolPin | undefined {
    if (name === undefined) return undefined;
    return configurationManifests()
        .values()
        .flatMap((manifest) => manifest.tools)
        .find((entry) => entry.name === name);
}

// The page a manifest declares for a rule: the tool's own page, or the page of the plugin whose prefix the rule carries.
function rulePage(check: CheckSpec, tool: string, rule: string): string | undefined {
    const slash = rule.lastIndexOf('/');
    if (slash === -1) {
        const pin = pinNamed(tool) ?? pinNamed(check.tool ?? check.command?.[0]);
        return pin?.rule_page?.replace('{rule}', rule);
    }
    const prefix = rule.slice(0, slash).replace(/^@/u, '');
    const plugin = [prefix, `${tool}-plugin-${prefix}`, `@${prefix}/${tool}-plugin`]
        .map((name) => pinNamed(name))
        .find((pin) => pin !== undefined);
    return plugin?.rule_page?.replace('{rule}', rule.slice(slash + 1));
}

function isSelected(session: Session, configurationName: string): boolean {
    return session.scopes.some((scope) =>
        scope.selected.some((manifest) => manifest.configuration.name === configurationName),
    );
}

function checkExplanation(session: Session | undefined, checkName: string): Explanation | undefined {
    const own = session?.policyFiles.policy.checks.find((entry) => entry.name === checkName);
    const found =
        allChecks().get(checkName) ??
        (own === undefined ? undefined : { check: repositoryCheckSpec(own), configuration: undefined });
    if (!found) return undefined;
    const { check, configuration } = found;
    const toolPrefix = `tools.${check.tool ?? check.command?.[0] ?? '~'}.`;
    const settings = (configuration?.settings ?? [])
        .filter((setting) => setting.name === check.limit || setting.name.startsWith(toolPrefix))
        .map((setting) => setting.name);
    const rules = Object.values(configuration?.rule_files ?? {}).flat();
    const owner =
        configuration === undefined ? 'repository command' : `${configuration.configuration.name} configuration`;
    const lines = [
        `${checkName}  (${owner}, ${check.stage} stage, ${check.level} level)`,
        '',
        `What it looks for: ${check.summary}`,
        `Why it matters: ${check.why}`,
        `What to do: ${check.help}`,
        ...(check.waits_for === undefined ? [] : [`Required setting: ${check.waits_for}`]),
        '',
        `Turn it off for some paths: gspot ignore ${quoteArgument(checkName)} --paths "<glob>" --reason "..."`,
    ];
    if (check.command)
        lines.push(`Turn one of its rules off: gspot ignore ${quoteArgument(checkName)} --rule <rule> --reason "..."`);
    if (check.fix_findings_exit_codes !== undefined)
        lines.push(`Correction exit codes that mean findings remain: ${check.fix_findings_exit_codes.join(', ')}`);
    const crashPattern = check.tool_errors ?? pinNamed(check.tool ?? check.command?.[0])?.crash_pattern;
    if (crashPattern !== undefined) lines.push(`Fatal tool diagnostic pattern: ${crashPattern}`);
    if (check.isolated_files === true)
        lines.push('Runs with selected files and declared configuration in an isolated directory.');
    if (settings.length > 0) lines.push(`Settings that change it: ${settings.join(', ')} (gspot set <key> <value>)`);
    if (rules.length > 0) lines.push(`Rule files that state it: ${rules.join(', ')}`);
    if (own !== undefined)
        lines.push(`Command: ${own.command.map(quoteArgument).join(' ')}`, `Paths: ${own.paths.join(', ')}`);
    if (session && configuration !== undefined)
        lines.push(
            isSelected(session, configuration.configuration.name)
                ? 'Selected in this repository: yes'
                : `Selected in this repository: no (gspot add ${configuration.configuration.name})`,
        );
    const { stage, summary, why, help, waits_for: waitsFor } = check;
    return {
        kind: 'check',
        subject: checkName,
        text: `${lines.join('\n')}\n`,
        data: {
            check: checkName,
            ...(configuration === undefined
                ? { command: own?.command, paths: own?.paths }
                : { configuration: configuration.configuration.name }),
            stage,
            level: check.level,
            summary,
            why,
            help,
            waits_for: waitsFor,
            ...(check.fix_findings_exit_codes === undefined
                ? {}
                : { fix_findings_exit_codes: check.fix_findings_exit_codes }),
            ...(crashPattern === undefined ? {} : { tool_errors: crashPattern }),
            ...(check.isolated_files === undefined ? {} : { isolated_files: check.isolated_files }),
            ...(check.file_prefix === undefined ? {} : { file_prefix: check.file_prefix }),
            settings,
            rules,
        },
    };
}

function toolSummary(session: Session | undefined, tool: string, rule: string): string | undefined {
    const source = TOOL_RULE_SOURCES[tool];
    if (!source) return undefined;
    const pin = pinNamed(tool);
    const probe = session && pin ? probeTool(session, pin) : undefined;
    return source(rule, probe?.path ?? tool);
}

function toolRuleExplanation(session: Session | undefined, tool: string, rule: string): Explanation | undefined {
    const check = allChecks()
        .values()
        .find(
            ({ check: spec }) => (spec.tool ?? spec.command?.[0] ?? '~') === tool || spec.name.endsWith(`/${tool}`),
        )?.check;
    if (!check) return undefined;
    const summary = toolSummary(session, tool, rule);
    const page = rulePage(check, tool, rule);
    const lines = [
        `${tool}/${rule}  (run by ${check.name})`,
        '',
        summary === undefined
            ? page === undefined
                ? `The tool's documentation has the page for ${rule}.`
                : `The tool's page: ${page}`
            : `The tool says: ${summary}`,
        '',
        `Turn it off everywhere: gspot ignore ${quoteArgument(check.name)} --rule ${quoteArgument(rule)} --reason "..."`,
        `Turn it off for some paths: gspot ignore ${quoteArgument(check.name)} --rule ${quoteArgument(rule)} --paths "<glob>" --reason "..."`,
        `Change its options: gspot set ${quoteArgument(`tools.${tool}.rules.${rule}`)} <options> --reason "..."`,
    ];
    return {
        kind: 'tool-rule',
        subject: `${tool}/${rule}`,
        text: `${lines.join('\n')}\n`,
        data: { tool, rule, check: check.name, summary: summary ?? null, page: page ?? null },
    };
}

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

function settingLines(
    key: string,
    spec: SettingSpec,
    scopes: { scope: string; shipped: unknown; current: ResolvedSetting | undefined }[],
): string[] {
    return [
        key,
        '',
        spec.summary,
        '',
        `Direction: ${DIRECTIONS[spec.direction] ?? spec.direction}`,
        ...scopes.flatMap(({ scope, shipped, current }) => {
            const target = scope === '' ? '' : ` --scope ${quoteArgument(scope)}`;
            return [
                '',
                `Scope: ${scope === '' ? 'root' : scope}`,
                `Shipped default: ${shipped === undefined ? 'none' : JSON.stringify(shipped)}`,
                `Current value: ${JSON.stringify(current?.value)} (from ${current?.source ?? 'unset'})`,
                ...(current?.reason === undefined ? [] : [`Reason on record: ${current.reason}`]),
                changeLine(spec, key, target),
                `Back to the default: gspot set ${quoteArgument(key)} --default${target}`,
            ];
        }),
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
