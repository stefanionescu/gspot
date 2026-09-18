// explain: a check, a tool rule, a preset or a setting, in plain words.
import type { Session } from '#types/run.ts';
import { nearMatches } from '#cli/policy/near.ts';
import { probeTool } from '#cli/doctor/probes.ts';
import * as messages from '#cli/policy/messages.ts';
import type { Explanation } from '#types/output.ts';
import { runBlocking } from '#cli/platform/spawn.ts';
import type { ResolvedSetting } from '#types/config.ts';
import { allChecks, toRow } from '#cli/presets/listing.ts';
import { settingValue, specFor } from '#cli/policy/settings.ts';
import { presetManifests } from '#cli/presets/read-manifests.ts';
import type { CheckSpec, ListingRow, SettingSpec } from '#types/manifest.ts';

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
    shellcheck: (rule) => `https://www.shellcheck.net/wiki/${rule}`,
    markdownlint: (rule) => `https://github.com/DavidAnson/markdownlint/blob/main/doc/${rule.toLowerCase()}.md`,
    eslint: (rule) => {
        const slash = rule.indexOf('/');
        if (slash === -1) return `https://eslint.org/docs/latest/rules/${rule}`;
        return `the ${rule.slice(0, slash)} plugin's page for ${rule.slice(slash + 1)}`;
    },
};

function toolOf(check: CheckSpec): string | undefined {
    return check.tool ?? check.command?.[0];
}

function isSelected(session: Session, presetId: string): boolean {
    return session.scopes.some((scope) => scope.selected.some((manifest) => manifest.preset.id === presetId));
}

function checkExplanation(session: Session | undefined, id: string): Explanation | undefined {
    const found = allChecks().get(id);
    if (!found) return undefined;
    const { check, preset } = found;
    const toolPrefix = `tools.${toolOf(check) ?? '~'}.`;
    const settings = preset.settings
        .filter((setting) => setting.name === check.limit || setting.name.startsWith(toolPrefix))
        .map((setting) => setting.name);
    const rules = Object.values(preset.rule_files).flat();
    const lines = [
        `${id}  (${preset.preset.id} preset, ${check.stage} stage)`,
        '',
        `What it looks for: ${check.summary}`,
        `Why it matters: ${check.why}`,
        `What to do: ${check.fix}`,
        '',
        `Turn it off for some paths: gspot ignore ${id} --paths "<glob>" --reason "..."`,
    ];
    if (check.command) lines.push(`Turn one of its rules off: gspot ignore ${id} --rule <rule> --reason "..."`);
    if (settings.length > 0) lines.push(`Settings that change it: ${settings.join(', ')} (gspot set <key> <value>)`);
    if (rules.length > 0) lines.push(`Rule files that state it: ${rules.join(', ')}`);
    if (session)
        lines.push(
            isSelected(session, preset.preset.id)
                ? 'Selected in this repository: yes'
                : `Selected in this repository: no (gspot add ${preset.preset.id})`,
        );
    const { stage, summary, why, fix } = check;
    return {
        kind: 'check',
        subject: id,
        text: `${lines.join('\n')}\n`,
        data: { id, preset: preset.preset.id, stage, summary, why, fix, settings, rules },
    };
}

function toolSummary(session: Session | undefined, tool: string, rule: string): string | undefined {
    const source = TOOL_RULE_SOURCES[tool];
    if (!source) return undefined;
    const pin = presetManifests()
        .values()
        .flatMap((manifest) => manifest.tools)
        .find((entry) => entry.name === tool);
    const probe = session && pin ? probeTool(session.root, pin) : undefined;
    return source(rule, probe?.path ?? tool);
}

function toolRuleExplanation(session: Session | undefined, tool: string, rule: string): Explanation | undefined {
    const check = allChecks()
        .values()
        .find(({ check: spec }) => toolOf(spec) === tool || spec.id.endsWith(`/${tool}`))?.check;
    if (!check) return undefined;
    const summary = toolSummary(session, tool, rule);
    const lines = [
        `${tool}/${rule}  (run by ${check.id})`,
        '',
        summary === undefined ? `The tool's documentation has the page for ${rule}.` : `The tool says: ${summary}`,
        '',
        `Turn it off everywhere: gspot ignore ${check.id} --rule ${rule} --reason "..."`,
        `Turn it off for some paths: gspot ignore ${check.id} --rule ${rule} --paths "<glob>" --reason "..."`,
        `Change its options: gspot set tools.${tool}.rules.${rule} <options> --reason "..."`,
    ];
    return {
        kind: 'tool-rule',
        subject: `${tool}/${rule}`,
        text: `${lines.join('\n')}\n`,
        data: { tool, rule, check: check.id, summary: summary ?? null },
    };
}

function listLine(label: string, items: string[]): string[] {
    return items.length === 0 ? [] : [`${label}: ${items.join(', ')}`];
}

function stageLines(row: ListingRow): string[] {
    return STAGES.flatMap((stage) =>
        listLine(
            `Checks at ${stage}`,
            row.checks.filter((check) => check.stage === stage).map((check) => check.id),
        ),
    );
}

function presetExplanation(id: string): Explanation | undefined {
    const manifest = presetManifests().get(id);
    if (!manifest) return undefined;
    const row = toRow(manifest);
    const { detect, claims } = manifest;
    const lines = [
        `${row.title} (${row.kind} preset)`,
        '',
        row.description,
        '',
        ...listLine('Detected by', [
            ...detect.extensions,
            ...detect.filenames,
            ...detect.dependencies.map((name) => `${name} in dependencies`),
        ]),
        ...listLine('Claims', [...claims.extensions, ...claims.filenames, ...claims.paths]),
        ...(claims.from_languages ? ['Claims: every file a language preset claims'] : []),
        ...listLine('Requires', row.requires),
        ...listLine('Tools it pins', row.tools),
        ...stageLines(row),
        ...listLine('Settings', row.settings),
        ...listLine('Rule files', row.rules),
    ];
    return { kind: 'preset', subject: id, text: `${lines.join('\n')}\n`, data: row };
}

function changeLine(spec: SettingSpec, key: string): string {
    const isReasoned = spec.direction === 'ceiling' || spec.direction === 'loosening';
    return `Change it: gspot set ${key} <value>${isReasoned ? ' --reason "..."' : ''}`;
}

function settingLines(
    key: string,
    spec: SettingSpec,
    shipped: unknown,
    current: ResolvedSetting | undefined,
): string[] {
    return [
        key,
        '',
        spec.summary,
        '',
        `Direction: ${DIRECTIONS[spec.direction] ?? spec.direction}`,
        `Shipped default: ${shipped === undefined ? 'none' : JSON.stringify(shipped)}`,
        `Current value: ${JSON.stringify(current?.value)} (from ${current?.source ?? 'unset'})`,
        ...(current?.reason === undefined ? [] : [`Reason on record: ${current.reason}`]),
        '',
        changeLine(spec, key),
        `Back to the default: gspot set ${key} --default`,
    ];
}

function settingExplanation(session: Session | undefined, key: string): Explanation | undefined {
    const root = session?.scopes[0];
    if (session === undefined || root === undefined) return undefined;
    const match = specFor(root.surface, key);
    if (match === undefined) return undefined;
    const current = settingValue(root.surface, session.policyFiles.policy, key);
    const shipped = root.surface.defaults.get(match.spec.name)?.value;
    const lines = settingLines(key, match.spec, shipped, current);
    return {
        kind: 'setting',
        subject: key,
        text: `${lines.join('\n')}\n`,
        data: { key, ...match.spec, current: current?.value, source: current?.source },
    };
}

function explainSlashed(session: Session | undefined, subject: string): Explanation | { error: string } {
    const check = checkExplanation(session, subject);
    if (check) return check;
    const slash = subject.indexOf('/');
    const toolRule = toolRuleExplanation(session, subject.slice(0, slash), subject.slice(slash + 1));
    if (toolRule) return toolRule;
    return { error: messages.unknownCheck(subject, nearMatches(subject, allChecks().keys().toArray())) };
}

function explainDotted(session: Session | undefined, subject: string): Explanation | { error: string } {
    const setting = settingExplanation(session, subject);
    if (setting) return setting;
    const known = session?.scopes[0]?.surface.specs.keys().toArray() ?? [];
    return { error: messages.settingNotExposed(subject, nearMatches(subject, known)) };
}

/**
 * Explains whatever the argument names, or returns the near matches.
 * @param session the session, or undefined outside a repository
 * @param subject a check id, a tool/rule pair, a preset id or a setting key
 * @returns the explanation, or an error naming the closest matches
 */
export function explain(session: Session | undefined, subject: string): Explanation | { error: string } {
    if (subject.includes('/')) return explainSlashed(session, subject);
    if (subject.includes('.')) return explainDotted(session, subject);
    const preset = presetExplanation(subject);
    if (preset) return preset;
    return { error: messages.unknownPreset(subject, nearMatches(subject, presetManifests().keys().toArray())) };
}
