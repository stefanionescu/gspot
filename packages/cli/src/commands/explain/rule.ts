import { LINT_RULE_LABELS } from '#cli/config/commands/lookup.ts';
import { WEAKENINGS_CHECK } from '#cli/config/settings/file.ts';
import { findRuleCheck, readListedRuleExplanation } from '#cli/configurations/lint-rules.ts';
import { selectCheckCode } from '#cli/configurations/registry.ts';
import {
    buildUnknownRuleError,
    findRuleTool,
    formatIgnoreCommand,
    hasRuleExplanations,
} from '#cli/engine/outputs/rules.ts';
import { SETTINGS_BY_CONFIGURATION } from '#cli/settings/available.ts';
import { findRuleSetting } from '#cli/settings/validation/rules.ts';
import { quoteArgument } from '#cli/system/text/quoting.ts';
import type { Explanation, LintRuleExplanation } from '#cli/types/commands.ts';
import type { Check, Configuration } from '#cli/types/manifests.ts';
import type { RuleExplanation, Session } from '#cli/types/tools.ts';

function formatRuleOptions(
    { check, configuration }: { check: Check; configuration: Configuration | undefined },
    tool: string | undefined,
    identifier: string,
): string | undefined {
    if (tool === undefined || configuration === undefined) return undefined;
    if (!hasRuleExplanations(check, selectCheckCode(check), identifier)) return undefined;
    const owner = findRuleSetting(tool, identifier);
    if (owner !== undefined) return `gspot set ${owner} <value>`;
    const key = `tools.${tool}.rules`;
    const setting = SETTINGS_BY_CONFIGURATION.get(configuration.name)?.find(({ name }) => name === key);
    if (setting?.type !== 'table') return undefined;
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
        ...(facts.turnOff.paths === null ? [] : [`Ignore it for some paths: ${facts.turnOff.paths}`]),
        ...(facts.changeOptions === null ? [] : [`Change its options: ${facts.changeOptions}`]),
    ];
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

/**
Explain one lint rule: its page, its description from the installed tool, and how to ignore it or change its
options. A rule of a command check gets the help of its check and the command that ignores it.

@param options.session the repository settings and tool project, when available.
@returns the explanation. A name outside the rules that gspot reads gets the help of its check.
@throws GspotError when gspot cannot name one lint rule of the check, when no shipped check and no command check has
this name, or when the check lists its rules and this is not one.
*/
export async function explainLintRule(
    root: string,
    checkId: string,
    identifier: string,
    { verbose, session }: { verbose?: boolean; session?: Session },
): Promise<Explanation> {
    const found = findRuleCheck(
        checkId,
        session?.settings.commandChecks,
        `gspot cannot explain one lint rule of ${checkId}. Leave out the rule to explain the whole check.`,
    );
    if (found === undefined) throw buildUnknownRuleError(identifier, checkId);
    const tool = findRuleTool(found.check);
    const docs = (await readListedRuleExplanation(root, found.check, identifier, session)) ?? { fix: found.check.help };
    const facts: LintRuleExplanation = {
        tool: tool ?? null,
        rule: identifier,
        check: found.check.id,
        ...buildRuleDocFacts(docs, { verbose }),
        turnOff: {
            everywhere: formatIgnoreCommand(found.check.id, identifier),
            paths:
                found.check.id === WEAKENINGS_CHECK
                    ? null
                    : `gspot ignore ${quoteArgument(found.check.id)} --rule ${quoteArgument(identifier)} --paths "<path>" --reason "<why>"`,
        },
        changeOptions: formatRuleOptions(found, tool, identifier) ?? null,
    };
    return {
        kind: 'lint-rule',
        subject: `${checkId} ${identifier}`,
        text: `${formatLintRuleLines(facts).join('\n')}\n`,
        facts,
    };
}
