import { CODE_MARK } from '#cli/config/commands/help.ts';
import {
    LINT_RULE_LABELS,
    REPOSITORY_COMMAND,
    RUN_IN_COPY_MESSAGE,
    SELECTED_YES_MESSAGE,
} from '#cli/config/commands/reports.ts';
import { SETTING_RULES } from '#cli/config/settings/validation.ts';
import { selectCheckCode } from '#cli/configurations/registry.ts';
import { readCheckRuleExplanation } from '#cli/configurations/rules.ts';
import { OUTPUT_FORMATS } from '#cli/engine/outputs/formats.ts';
import { describeCheck } from '#cli/engine/reference.ts';
import { hasRuleExplanations } from '#cli/engine/results.ts';
import { selectRuleFiles } from '#cli/generation/rules.ts';
import { LIMIT_SETTING_RULES } from '#cli/manifests/limits.ts';
import { listChecksById, listRuleFiles, readConfigurations } from '#cli/manifests/read.ts';
import { isConfigurationSelected } from '#cli/manifests/select.ts';
import { SETTINGS_BY_CONFIGURATION } from '#cli/settings/available.ts';
import { GspotError } from '#cli/system/errors.ts';
import { quoteArgument, quoteCommand } from '#cli/system/text.ts';
import { findToolName, getTool } from '#cli/tools/pins.ts';
import type {
    CheckExplanation,
    CheckFacts,
    CheckIgnore,
    Explanation,
    LintRuleExplanation,
} from '#cli/types/commands/reports.ts';
import type { Check, Configuration, ConfigurationCheck } from '#cli/types/manifests.ts';
import type { RuleExplanation, ScopeCheck, Session } from '#cli/types/tools.ts';

function listCheckIgnores(session: Session | undefined, checkId: string): CheckIgnore[] {
    return (session?.settings.ignore ?? [])
        .filter((ignore) => ignore.check === checkId)
        .map(({ rule, paths, reason }) => ({
            rule,
            paths,
            reason,
            command: [
                `gspot unignore ${quoteArgument(checkId)}`,
                ...(rule === undefined ? [] : [`--rule ${quoteArgument(rule)}`]),
                ...(paths === undefined ? [] : paths.flatMap((path) => ['--paths', quoteArgument(path)])),
            ].join(' '),
        }));
}

function buildCheckFacts(
    check: Check,
    configuration: Configuration | undefined,
    session: Session | undefined,
): CheckFacts {
    const reference = describeCheck(
        check,
        readConfigurations().values().toArray(),
        selectCheckCode(check)?.explanations,
    );
    const toolName = reference.toolName;
    const installedRules = new Set(session === undefined ? [] : selectRuleFiles(session).map((file) => file.path));
    const settings = (configuration === undefined ? [] : (SETTINGS_BY_CONFIGURATION.get(configuration.name) ?? []))
        .filter((setting) => toolName !== undefined && setting.name.startsWith(`tools.${toolName}.`))
        .map((setting) => setting.name);
    const ruleFiles =
        configuration === undefined
            ? []
            : listRuleFiles(configuration)
                  .filter((file) => installedRules.has(file.path))
                  .map((file) => file.path);
    const crashPattern =
        toolName === undefined ? undefined : getTool(readConfigurations().values(), toolName).crash_pattern;
    return {
        settings,
        ruleFiles,
        crashPattern,
        ignores: listCheckIgnores(session, check.id),
        minVersions: reference.minVersions,
        turnOff: reference.turnOff,
    };
}

function formatCheckIgnore(ignore: CheckIgnore): string {
    const paths = ignore.paths === undefined ? 'everywhere' : `in ${ignore.paths.join(', ')}`;
    const target = ignore.rule === undefined ? paths : `rule ${ignore.rule} ${paths}`;
    return `  ${target}: ${ignore.reason}  (undo: ${ignore.command})`;
}

function formatRepositoryUse(facts: CheckExplanation): string[] {
    const lines: string[] = [];
    if (facts.command !== null)
        lines.push(`Command: ${quoteCommand(facts.command)}`, `Paths: ${(facts.paths ?? []).join(', ')}`);
    if (facts.selected !== null)
        lines.push(
            facts.selected
                ? SELECTED_YES_MESSAGE
                : `Selected in this repository: no (gspot add ${String(facts.configuration)})`,
        );
    if (facts.ignores.length > 0)
        lines.push('Ignored in this repository:', ...facts.ignores.map((ignore) => formatCheckIgnore(ignore)));
    return lines;
}

function formatCheckExplanation(facts: CheckExplanation): string {
    const { settingNames: settings, ruleFiles, minVersions } = facts;
    const source = facts.configuration === null ? REPOSITORY_COMMAND : `${facts.configuration} configuration`;
    const lines = [
        `${facts.check}  (${source}, ${facts.stage} stage, ${facts.level} level)`,
        '',
        `What it looks for: ${facts.summary.replaceAll(CODE_MARK, '')}`,
        `Why it matters: ${facts.why.replaceAll(CODE_MARK, '')}`,
        `What to do: ${facts.help.replaceAll(CODE_MARK, '')}`,
        ...(facts.condition?.setting === undefined ? [] : [`Required setting: ${facts.condition.setting}`]),
        ...Object.entries(minVersions).map(([name, version]) => `Needs ${name} ${version} or newer.`),
        '',
        'Ignore it only with a reason your team accepts.',
        `Ignore it for some paths: ${facts.turnOff.paths}`,
        ...(facts.turnOff.rule === null ? [] : [`Ignore one of its lint rules: ${facts.turnOff.rule}`]),
        ...(facts.runInCopy === true ? [RUN_IN_COPY_MESSAGE] : []),
        ...(settings.length === 0
            ? []
            : [`Settings that change it: ${settings.join(', ')} (gspot set <setting> <value>)`]),
        ...(ruleFiles.length === 0 ? [] : [`Rule files that state it: ${ruleFiles.join(', ')}`]),
        ...formatRepositoryUse(facts),
    ];
    return `${lines.join('\n')}\n`;
}

function formatRuleOptions(
    tool: string | undefined,
    identifier: string,
    configuration: Configuration,
): string | undefined {
    if (tool === undefined) return undefined;
    const owner = { ...LIMIT_SETTING_RULES[tool], ...SETTING_RULES[tool] }[identifier];
    if (owner !== undefined) return `gspot set ${owner} <value>`;
    const key = `tools.${tool}.rules`;
    const settings = SETTINGS_BY_CONFIGURATION.get(configuration.name);
    if (settings?.some((setting) => setting.name === key) !== true) return undefined;
    const ruleExample = quoteArgument(`{ ${JSON.stringify(identifier)} = [<options>] }`);
    return `gspot set ${quoteArgument(key)} ${ruleExample}`;
}

function formatLintRuleLines(facts: LintRuleExplanation): string[] {
    const { tool, rule, page } = facts;
    const pageLines = page === null ? [] : [`The tool's page: ${page}`];
    if (page === null && tool !== null) pageLines.push(`Read the ${tool} documentation for ${rule}.`);
    return [
        `${facts.check} ${rule}`,
        '',
        ...LINT_RULE_LABELS.flatMap(([key, label]) => (facts[key] === null ? [] : [`${label}: ${facts[key]}`])),
        ...(facts.explanation === null ? [] : ['', facts.explanation]),
        ...pageLines,
        '',
        'Ignore it only with a reason your team accepts.',
        `Ignore it everywhere: ${facts.turnOff.everywhere}`,
        `Ignore it for some paths: ${facts.turnOff.paths}`,
        ...(facts.changeOptions === null ? [] : [`Change its options: ${facts.changeOptions}`]),
    ];
}

async function readRuleDocs(
    root: string,
    check: Check,
    identifier: string,
    session: Session | undefined,
): Promise<Awaited<ReturnType<typeof readCheckRuleExplanation>>> {
    const docs = await readCheckRuleExplanation(root, check, identifier, session);
    if (docs !== undefined) return docs;
    return hasRuleExplanations(check, selectCheckCode(check)) ? undefined : { fix: check.help };
}

function buildRuleDocFacts(
    docs: RuleExplanation,
    { verbose }: { verbose: boolean | undefined },
): Pick<LintRuleExplanation, 'page' | 'description' | 'why' | 'fix' | 'example' | 'explanation'> {
    const { url, description, why, fix, example } = docs;
    const explanation = verbose === true ? (docs.explanation ?? null) : null;
    return {
        page: url ?? null,
        description: description ?? null,
        why: why ?? null,
        fix: fix ?? null,
        example: example ?? null,
        explanation,
    };
}

function findRuleCheck(checkId: string): ConfigurationCheck | undefined {
    const found = listChecksById(readConfigurations().values()).get(checkId);
    if (
        found !== undefined &&
        !OUTPUT_FORMATS[found.check.output.format].namesRules(found.check.output) &&
        selectCheckCode(found.check)?.explanations === undefined
    )
        throw new GspotError(
            'arguments',
            `gspot cannot explain one lint rule of ${checkId}. Leave out the rule to explain the whole check.`,
        );
    return found;
}

function buildCheckOrigin(
    check: Check,
    configuration: Configuration | undefined,
): Pick<CheckExplanation, 'configuration' | 'command' | 'paths'> {
    if (configuration !== undefined) return { configuration: configuration.name, command: null, paths: null };
    const paths = check.files?.paths ?? null;
    return { configuration: null, command: check.command ?? null, paths };
}

function buildCheckExplanation(
    found: Pick<ScopeCheck, 'check' | 'configuration'>,
    session: Session | undefined,
): CheckExplanation {
    const { check, configuration } = found;
    const described = buildCheckFacts(check, configuration, session);
    const selected =
        session === undefined || configuration === undefined
            ? null
            : isConfigurationSelected(session.scopes, configuration.name);
    return {
        check: check.id,
        ...buildCheckOrigin(check, configuration),
        stage: check.stage,
        level: check.level,
        summary: check.summary,
        why: check.why,
        help: check.help,
        condition: check.when ?? null,
        crashPattern: described.crashPattern ?? null,
        runInCopy: check.run_in_copy ?? null,
        minVersions: described.minVersions,
        turnOff: { ...described.turnOff, rule: described.turnOff.rule ?? null },
        settingNames: described.settings,
        ruleFiles: described.ruleFiles,
        selected,
        ignores: described.ignores,
    };
}

/**
Explain a shipped check or a command check.

@param session the repository, or undefined outside one.
@param checkId the check ID to explain.
@returns undefined when no check has the ID.
*/
export function explainCheck(session: Session | undefined, checkId: string): Explanation | undefined {
    const commandCheck = session?.settings.commandChecks[checkId];
    const found: Pick<ScopeCheck, 'check' | 'configuration'> | undefined =
        listChecksById(readConfigurations().values()).get(checkId) ??
        (commandCheck === undefined ? undefined : { check: commandCheck, configuration: undefined });
    if (found === undefined) return undefined;
    const facts = buildCheckExplanation(found, session);
    return { kind: 'check', subject: checkId, text: formatCheckExplanation(facts), facts };
}

/**
Explain one lint rule: its page, its description from the installed tool, and how to ignore it or change its
options.

@param root the repository root, whose tool project holds ESLint and Stylelint.
@param checkId the check that runs the rule.
@param identifier the rule ID, including its plugin prefix.
@param options the detail level and the session.
@param options.verbose whether to include the full explanation.
@param options.session the repository settings and tool project, when available.
@returns undefined when no check runs the tool, or when the tool lists its rules and this is not one. A tool that lists
none gets the help of its check.
@throws GspotError when gspot cannot name one lint rule of the check.
*/
export async function explainLintRule(
    root: string,
    checkId: string,
    identifier: string,
    { verbose, session }: { verbose?: boolean; session?: Session } = {},
): Promise<Explanation | undefined> {
    const found = findRuleCheck(checkId);
    if (found === undefined) return undefined;
    const tool = OUTPUT_FORMATS[found.check.output.format].namesRules(found.check.output)
        ? findToolName(found.check)
        : undefined;
    const docs = await readRuleDocs(root, found.check, identifier, session);
    if (docs === undefined) return undefined;
    const ignore = `gspot ignore ${quoteArgument(found.check.id)} --rule ${quoteArgument(identifier)}`;
    const facts: LintRuleExplanation = {
        tool: tool ?? null,
        rule: identifier,
        check: found.check.id,
        ...buildRuleDocFacts(docs, { verbose }),
        turnOff: {
            everywhere: `${ignore} --reason "<why>"`,
            paths: `${ignore} --paths "<path>" --reason "<why>"`,
        },
        changeOptions: formatRuleOptions(tool, identifier, found.configuration) ?? null,
    };
    return {
        kind: 'lint-rule',
        subject: `${checkId} ${identifier}`,
        text: `${formatLintRuleLines(facts).join('\n')}\n`,
        facts,
    };
}
