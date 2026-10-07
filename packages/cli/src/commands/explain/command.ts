// Explain a check, tool rule, configuration, setting, or file path.
import { resolve } from 'node:path';
import { hasPolicy } from '#cli/policy/read.ts';
import { findRoot } from '#cli/repository/root.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { openSession } from '#cli/commands/session.ts';
import { printResult } from '#cli/terminal/messages.ts';
import { quoteArgument } from '#cli/platform/quoting.ts';
import { similar, codeList } from '#cli/platform/text.ts';
import { explainPath } from '#cli/commands/explain/path.ts';
import type { Program } from '#cli/types/commands/program.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import type { SettingSpec } from '#cli/types/configurations.ts';
import { DIRECTION_TEXTS } from '#cli/config/commands/explain.ts';
import { checkStageSchema } from '#cli/parsers/schema/command.ts';
import { specFor, settingValue } from '#cli/policy/settings/lookup.ts';
import { readEslintRuleNames } from '#cli/generation/eslint/presets.ts';
import { configurationFiles } from '#cli/configurations/declarations.ts';
import { explainCheck, explainToolRule } from '#cli/commands/explain/check.ts';
import { knownChecks, configurationManifests } from '#cli/configurations/manifests.ts';
import type { Explanation, SettingScope, ConfigurationExplanation } from '#cli/types/commands/explain.ts';

function formatList(label: string, items: string[]): string[] {
    return items.length === 0 ? [] : [`${label}: ${items.join(', ')}`];
}

function explainConfiguration(configurationName: string): Explanation | undefined {
    const manifest = configurationManifests().get(configurationName);
    if (manifest === undefined) return undefined;
    const row: ConfigurationExplanation = {
        name: manifest.configuration.name,
        kind: manifest.configuration.kind,
        title: manifest.configuration.title,
        description: manifest.configuration.description,
        requires: manifest.configuration.requires,
        tools: manifest.tools.map((tool) => (tool.version === undefined ? tool.name : `${tool.name} ${tool.version}`)),
        checks: manifest.checks.map((check) => ({ check: check.name, stage: check.stage })),
        settings: manifest.settings.map((setting) => setting.name),
        guides: configurationFiles(manifest).map((file) => file.path),
        auto: manifest.configuration.always_selected,
    };
    const { detect, files } = manifest;
    const lines = [
        `${row.title} (${row.kind} configuration)`,
        '',
        row.description,
        '',
        ...formatList('Detected by', [
            ...detect.extensions,
            ...detect.filenames,
            ...detect.dependencies.map((name) => `${name} in dependencies`),
        ]),
        ...formatList('Files', [...files.extensions, ...files.filenames, ...files.paths]),
        ...(files.languages ? ['Files: every file a language configuration owns'] : []),
        ...(files.prettier_plugins ? ['Files: the file types of the selected Prettier plugins'] : []),
        ...(files.eslint_plugins ? ['Files: the file types of the selected ESLint plugins'] : []),
        ...formatList('Requires', row.requires),
        ...formatList('Tools it pins', row.tools),
        ...checkStageSchema.options.flatMap((stage) =>
            formatList(
                `Checks at ${stage}`,
                row.checks.filter((check) => check.stage === stage).map((check) => check.check),
            ),
        ),
        ...formatList('Settings', row.settings),
        ...formatList('Guides', row.guides),
    ];
    return { kind: 'configuration', subject: configurationName, text: `${lines.join('\n')}\n`, data: row };
}

// The lines about one scope: its default, its current value and source, and how to change it.
function scopeLines(key: string, spec: SettingSpec, entry: SettingScope): string[] {
    const { scope, shipped, effective } = entry;
    const { value, source = 'unset', reason } = effective === undefined ? {} : effective;
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

function explainSetting(session: ToolSession | undefined, key: string): Explanation | undefined {
    if (session === undefined) return undefined;
    const scopes = session.scopes.flatMap((selection) => {
        const match = specFor(selection.surface, key);
        if (match === undefined) return [];
        return [
            {
                scope: selection.scope.path,
                spec: match.spec,
                effective: settingValue(selection.surface, session.policyFiles.policy, key, selection.scope.path),
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
        `Direction: ${DIRECTION_TEXTS[first.spec.direction]}`,
        ...scopes.flatMap((entry) => scopeLines(key, first.spec, entry)),
    ];
    return {
        kind: 'setting',
        subject: key,
        text: `${lines.join('\n')}\n`,
        data: {
            key,
            ...first.spec,
            scopes: scopes.map(({ scope, shipped, effective }) => ({
                scope,
                default: shipped,
                current: effective?.value,
                source: effective?.source,
                reason: effective?.reason,
            })),
        },
    };
}

function buildSubjectSuggestion(subject: string, candidates: string[]): string {
    const matches = similar(subject, candidates);
    if (matches.length === 0) return '';
    return ' Did you mean ' + codeList(matches) + '?';
}

function buildUnknownSubjectDiagnostic(session: ToolSession | undefined, subject: string): string {
    const checks = knownChecks(session?.policyFiles.policy.checks ?? []);
    if (subject.includes('/')) {
        return `There is no check called \`${subject}\`.${buildSubjectSuggestion(subject, checks)}`;
    }
    if (subject.includes('.')) {
        const known = [...new Set(session?.scopes.flatMap((scope) => [...scope.surface.specs.keys()]))];
        const matches = similar(subject, known);
        return `No selected configuration has the setting \`${subject}\`. ${
            matches.length === 0
                ? 'No setting exists under that table.'
                : 'The settings that exist under that table are ' + codeList(matches) + '.'
        } Run \`gspot list settings\` to see every one.`;
    }
    return `There is no configuration called \`${subject}\`.${buildSubjectSuggestion(subject, configurationManifests().keys().toArray())} Run \`gspot list configurations\` to see the available configurations.`;
}

// A check retains its meaning; a tracked path precedes a tool rule with the same first folder.
function explainSlashed(
    session: ToolSession | undefined,
    subject: string,
    file: Explanation | undefined,
): Explanation | undefined {
    const check = explainCheck(session, subject);
    if (check !== undefined) return check;
    if (file !== undefined) return file;
    const slash = subject.indexOf('/');
    return explainToolRule(session, subject.slice(0, slash), subject.slice(slash + 1));
}

function explainNamed(session: ToolSession | undefined, subject: string): Explanation | undefined {
    const named = explainSetting(session, subject) ?? explainConfiguration(subject);
    if (named !== undefined) return named;
    if (!readEslintRuleNames().rules.includes(subject)) return undefined;
    return explainToolRule(session, 'eslint', subject);
}

/**
 * Explains whatever the argument names, or returns the near matches.
 * @param session the session, or undefined outside a repository.
 * @param subject a check name, a tool/rule pair, a configuration name, a setting key, or a file path.
 * @returns the requested explanation
 * @throws GspotError when no subject or file matches, with the closest known names
 */
export function explain(session: ToolSession | undefined, subject: string): Explanation {
    const file = explainPath(session, subject);
    if (file !== undefined && subject.startsWith('./')) return file;
    let explanation: Explanation | undefined;
    if (subject.includes('/')) explanation = explainSlashed(session, subject, file);
    else if (subject.includes('.')) explanation = explainSetting(session, subject);
    else explanation = explainNamed(session, subject);
    if (explanation !== undefined) return explanation;
    if (file !== undefined) return file;
    throw new GspotError('selection', buildUnknownSubjectDiagnostic(session, subject));
}

/**
 * Registers explain.
 * @param program the commander program
 */
export function registerExplain(program: Program): void {
    program
        .command('explain')
        .argument('<subject>', 'Check, tool rule, configuration, dotted setting, or repository file path')
        .summary('Explain a check, rule, configuration, setting, or file')
        .description(
            'Explain a check, a tool rule, a configuration, a setting, or a file path: what it is and what to do about it. A rule also gets the gspot ignore and gspot set lines that change it. A setting gets its value, its default, and where the value comes from. A file gets the checks that read it. explain changes nothing.',
        )
        .addHelpText(
            'after',
            '\nExit codes:\n- 0: the explanation was printed.\n- 2: the subject is unknown, or the input was invalid.\n\nExample:\ngspot explain bash/syntax',
        )
        .action(async (subject, _flags, command) => {
            const global = command.optsWithGlobals();
            const cwd = resolve(global.C ?? process.cwd());
            const root = findRoot(cwd);
            const session = hasPolicy(root) ? await openSession(root) : undefined;
            const result = explain(session, subject);
            printResult({
                text: result.text,
                json: { ...result.data, kind: result.kind, subject: result.subject },
                exitCode: 0,
            });
        });
}
