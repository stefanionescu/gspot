import { selectCheckCode } from '#cli/configurations/registry.ts';
import { buildUnknownRuleError, canIgnoreRule, findRuleTool, hasRuleExplanations } from '#cli/engine/outputs/rules.ts';
import { findCheck, readShippedChecks } from '#cli/manifests/checks.ts';
import { isConfigurationSelected } from '#cli/settings/scopes.ts';
import { GspotError } from '#cli/system/errors.ts';
import { readToolBinPaths } from '#cli/tools/programs/mise.ts';
import { readLintRuleExplanation } from '#cli/tools/rules/explanations.ts';
import type { Check, Configuration } from '#cli/types/manifests.ts';
import type { RuleExplanation, RuleExplanationOptions, Session } from '#cli/types/tools.ts';

function rethrowForUnselectedCheck(error: unknown, check: Check, session: Session | undefined): never {
    const name = readShippedChecks().get(check.id)?.configuration.name;
    if (
        !(error instanceof GspotError) ||
        error.code !== 'tool' ||
        session === undefined ||
        name === undefined ||
        isConfigurationSelected(session.scopes, name)
    )
        throw error;
    throw new GspotError('tool', `${name} is not selected. Run gspot add ${name}, then gspot install.`, {
        cause: error,
    });
}

async function readCheckRuleExplanation(
    root: string,
    check: Check,
    identifier: string,
    session?: Session,
): Promise<RuleExplanation | undefined> {
    const explanations = selectCheckCode(check)?.explanations;
    if (explanations !== undefined)
        return Object.hasOwn(explanations, identifier) ? explanations[identifier] : undefined;
    const tool = findRuleTool(check);
    if (tool === undefined) return undefined;
    const options: RuleExplanationOptions = { help: check.help };
    if (session !== undefined) {
        options.timeoutSeconds = session.settings.tool_timeout_seconds;
        options.readMiseBinPaths = async () => {
            const { folders } = await readToolBinPaths(session);
            return folders;
        };
    }
    return await readLintRuleExplanation(root, tool, identifier, options).catch((error: unknown) =>
        rethrowForUnselectedCheck(error, check, session),
    );
}

/**
Read the explanation of a rule from the rule catalog of its check.

@returns `undefined` when the check has no rule catalog that covers the rule.
@throws GspotError when the catalog does not hold the rule.
*/
export async function readListedRuleExplanation(
    root: string,
    check: Check,
    rule: string,
    session?: Session,
): Promise<RuleExplanation | undefined> {
    if (!hasRuleExplanations(check, selectCheckCode(check), rule)) return undefined;
    const docs = await readCheckRuleExplanation(root, check, rule, session);
    if (docs === undefined) throw buildUnknownRuleError(rule, check.id);
    return docs;
}

/**
Find a check whose findings name their lint rule, so that gspot can explain or ignore one of its rules.

@param refusal the message of the error when the findings of the check name no lint rule.
@returns undefined when no check has this id.
*/
export function findRuleCheck(
    checkId: string,
    commandChecks: Readonly<Record<string, Check>> | undefined,
    refusal: string,
): { check: Check; configuration: Configuration | undefined } | undefined {
    const found = findCheck(checkId, commandChecks);
    if (found !== undefined && !canIgnoreRule(found.check, selectCheckCode(found.check)))
        throw new GspotError('arguments', refusal);
    return found;
}
