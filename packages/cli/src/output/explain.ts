// explain: a check, a tool rule, a preset or a setting, in plain words.
import { allChecks, toRow } from '#cli/presets/catalog.ts';
import { loadManifests } from '#cli/presets/load.ts';
import { nearMatches } from '#cli/policy/near.ts';
import * as messages from '#cli/policy/messages.ts';
import { resolveSetting, specFor } from '#cli/policy/settings.ts';
import type { Session } from '#cli/run/session.ts';
import { runSync } from '#cli/platform/spawn.ts';
import { probeTool } from '#cli/doctor/probes.ts';

export type Explanation = {
    kind: 'check' | 'tool-rule' | 'preset' | 'setting';
    subject: string;
    text: string;
    data: Record<string, unknown>;
};

const TOOL_RULE_SOURCES: Record<string, (rule: string, path: string) => string | undefined> = {
    ruff: (rule, path) => {
        const result = runSync([path, 'rule', rule, '--output-format', 'json'], {
            cwd: process.cwd(),
            timeoutMs: 10_000,
        });
        if (result.code !== 0) return undefined;
        try {
            const data = JSON.parse(result.stdout) as { name?: string; summary?: string; message_formats?: string[] };
            return [data.name, data.summary].filter(Boolean).join(': ');
        } catch {
            return undefined;
        }
    },
    swiftlint: (rule, path) => {
        const result = runSync([path, 'rules', rule], { cwd: process.cwd(), timeoutMs: 10_000 });
        return result.code === 0 ? result.stdout.split('\n').slice(0, 6).join('\n').trim() : undefined;
    },
    shellcheck: (rule) => `https://www.shellcheck.net/wiki/${rule}`,
    markdownlint: (rule) => `https://github.com/DavidAnson/markdownlint/blob/main/doc/${rule.toLowerCase()}.md`,
    eslint: (rule) =>
        rule.includes('/')
            ? `the ${rule.split('/')[0]} plugin's page for ${rule.split('/').slice(1).join('/')}`
            : `https://eslint.org/docs/latest/rules/${rule}`,
};

function checkExplanation(session: Session | undefined, id: string): Explanation | undefined {
    const found = allChecks().get(id);
    if (!found) return undefined;
    const { check, preset } = found;
    const settings = preset.settings
        .filter(
            (setting) =>
                (check.limit ? setting.name === check.limit : false) ||
                setting.name.startsWith(`tools.${check.tool ?? check.command?.[0] ?? '~'}.`),
        )
        .map((setting) => setting.name);
    const rules = Object.values(preset.rules).flat();
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
    if (session) {
        const active = session.scopes.some((scope) =>
            scope.selected.some((manifest) => manifest.preset.id === preset.preset.id),
        );
        lines.push(
            active
                ? 'Selected in this repository: yes'
                : `Selected in this repository: no (gspot add ${preset.preset.id})`,
        );
    }
    return {
        kind: 'check',
        subject: id,
        text: `${lines.join('\n')}\n`,
        data: {
            id,
            preset: preset.preset.id,
            stage: check.stage,
            summary: check.summary,
            why: check.why,
            fix: check.fix,
            settings,
            rules,
        },
    };
}

function toolRuleExplanation(session: Session | undefined, tool: string, rule: string): Explanation | undefined {
    const checks = [...allChecks().values()].filter(
        ({ check }) => (check.tool ?? check.command?.[0]) === tool || check.id.endsWith(`/${tool}`),
    );
    if (checks.length === 0) return undefined;
    const check = checks[0]!.check;
    const pin = [...loadManifests().values()]
        .flatMap((manifest) => manifest.tools)
        .find((entry) => entry.name === tool);
    const probe = session && pin ? probeTool(session.root, pin) : undefined;
    const source = TOOL_RULE_SOURCES[tool];
    const summary = source ? source(rule, probe?.path ?? tool) : undefined;
    const lines = [
        `${tool}/${rule}  (run by ${check.id})`,
        '',
        summary ? `The tool says: ${summary}` : `The tool's documentation has the page for ${rule}.`,
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

function presetExplanation(id: string): Explanation | undefined {
    const manifest = loadManifests().get(id);
    if (!manifest) return undefined;
    const row = toRow(manifest);
    const lines = [`${row.title} (${row.kind} preset)`, '', row.description, ''];
    const detect = [
        ...manifest.detect.extensions,
        ...manifest.detect.filenames,
        ...manifest.detect.dependencies.map((name) => `${name} in dependencies`),
    ];
    if (detect.length > 0) lines.push(`Detected by: ${detect.join(', ')}`);
    const claims = [...manifest.claims.extensions, ...manifest.claims.filenames, ...manifest.claims.paths];
    if (claims.length > 0) lines.push(`Claims: ${claims.join(', ')}`);
    if (manifest.claims.from_languages) lines.push('Claims: every file a language preset claims');
    if (row.requires.length > 0) lines.push(`Requires: ${row.requires.join(', ')}`);
    if (row.tools.length > 0) lines.push(`Tools it pins: ${row.tools.join(', ')}`);
    for (const stage of ['commit', 'push', 'manual', 'message']) {
        const ids = row.checks.filter((check) => check.stage === stage).map((check) => check.id);
        if (ids.length > 0) lines.push(`Checks at ${stage}: ${ids.join(', ')}`);
    }
    if (row.settings.length > 0) lines.push(`Settings: ${row.settings.join(', ')}`);
    if (row.rules.length > 0) lines.push(`Rule files: ${row.rules.join(', ')}`);
    return { kind: 'preset', subject: id, text: `${lines.join('\n')}\n`, data: row };
}

function settingExplanation(session: Session | undefined, key: string): Explanation | undefined {
    if (!session) return undefined;
    const root = session.scopes[0]!;
    const match = specFor(root.surface, key);
    if (!match) return undefined;
    const resolved = resolveSetting(root.surface, session.loaded.policy, key);
    const shipped = root.surface.defaults.get(match.spec.name);
    const direction: Record<string, string> = {
        ceiling: 'a ceiling: raising it needs a reason',
        floor: 'a floor: lowering it needs a reason',
        loosening: 'a loosening: setting it needs a reason',
        tightening: 'a tightening: no reason needed',
        neutral: 'neutral: no reason needed',
        'per-rule': 'per rule: options and rules turned on; off is an ignore',
    };
    const lines = [
        key,
        '',
        match.spec.summary,
        '',
        `Direction: ${direction[match.spec.direction]}`,
        `Shipped default: ${shipped === undefined ? 'none' : JSON.stringify(shipped.value)}`,
        `Current value: ${JSON.stringify(resolved?.value)} (from ${resolved?.source})`,
    ];
    if (resolved?.reason) lines.push(`Reason on record: ${resolved.reason}`);
    lines.push(
        '',
        `Change it: gspot set ${key} <value>${match.spec.direction === 'ceiling' || match.spec.direction === 'loosening' ? ' --reason "..."' : ''}`,
        `Back to the default: gspot set ${key} --default`,
    );
    return {
        kind: 'setting',
        subject: key,
        text: `${lines.join('\n')}\n`,
        data: { key, ...match.spec, current: resolved?.value, source: resolved?.source },
    };
}

/** Explains whatever the argument names, or returns the near matches. */
export function explain(session: Session | undefined, subject: string): Explanation | { error: string } {
    if (subject.includes('/')) {
        const check = checkExplanation(session, subject);
        if (check) return check;
        const [tool, ...rest] = subject.split('/');
        const toolRule = toolRuleExplanation(session, tool!, rest.join('/'));
        if (toolRule) return toolRule;
        return { error: messages.unknownCheck(subject, nearMatches(subject, [...allChecks().keys()])) };
    }
    if (subject.includes('.')) {
        const setting = settingExplanation(session, subject);
        if (setting) return setting;
        const known = session ? [...session.scopes[0]!.surface.specs.keys()] : [];
        return { error: messages.settingNotExposed(subject, nearMatches(subject, known)) };
    }
    const preset = presetExplanation(subject);
    if (preset) return preset;
    return { error: messages.unknownPreset(subject, nearMatches(subject, [...loadManifests().keys()])) };
}
