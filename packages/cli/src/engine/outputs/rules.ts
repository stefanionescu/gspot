import { GspotError } from '#cli/system/errors.ts';
import type { Check } from '#cli/types/manifests.ts';
import { findToolName } from '#cli/manifests/tools.ts';
import { quoteArgument } from '#cli/system/text/quoting.ts';
import { readShippedChecks } from '#cli/manifests/checks.ts';
import { OUTPUT_FORMATS } from '#cli/engine/outputs/formats.ts';
import type { Finding, CheckCode } from '#cli/types/engine/run.ts';
import { canReadRuleExplanations } from '#cli/tools/rules/explanations.ts';

export function canIgnoreRule(check: Check, code: CheckCode | undefined): boolean {
    return OUTPUT_FORMATS[check.output.format].namesRules(check.output) || code?.explanations !== undefined;
}

/**
Find the tool whose rules gspot reads: the tool of a check whose output names lint rules.
*/
export function findRuleTool(check: Check): string | undefined {
    return OUTPUT_FORMATS[check.output.format].namesRules(check.output) ? findToolName(check) : undefined;
}

/**
Tell whether a check has a rule catalog that covers a rule: rule explanations in its code, or a tool whose rules gspot
reads. Only then can gspot explain the rule, or check it against the rules that exist.
*/
export function hasRuleExplanations(check: Check, code: CheckCode | undefined, rule: string): boolean {
    if (code?.explanations !== undefined) return true;
    const tool = findRuleTool(check);
    return tool !== undefined && canReadRuleExplanations(tool, rule);
}

export function buildUnknownRuleError(rule: string, checkId: string): GspotError {
    return new GspotError('arguments', `gspot does not know rule ${rule} of ${checkId}.`);
}

export function formatExplainCommand(
    finding: Pick<Finding, 'check' | 'rule'>,
    selectCheckCode: (check: Check) => CheckCode | undefined,
): string {
    const argumentsList = [finding.check];
    const found = readShippedChecks().get(finding.check);
    const code = found === undefined ? undefined : selectCheckCode(found.check);
    if (
        found !== undefined &&
        finding.rule !== undefined &&
        hasRuleExplanations(found.check, code, finding.rule) &&
        (code?.explanations === undefined || Object.hasOwn(code.explanations, finding.rule))
    )
        argumentsList.push(finding.rule);
    return `gspot explain ${argumentsList.map((argument) => quoteArgument(argument)).join(' ')}`;
}

/**
Format the command that ignores one rule of a check everywhere. With no rule to name, the command shows `<rule>`.
*/
export function formatIgnoreCommand(checkId: string, rule: string | undefined): string {
    return `gspot ignore ${quoteArgument(checkId)} --rule ${rule === undefined ? '<rule>' : quoteArgument(rule)} --reason "<why>"`;
}
