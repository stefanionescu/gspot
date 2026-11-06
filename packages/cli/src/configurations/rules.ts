import { selectCheckCode } from '#cli/configurations/registry.ts';
import { OUTPUT_FORMATS } from '#cli/engine/outputs/formats.ts';
import { readToolBinPaths } from '#cli/tools/locate.ts';
import { findToolName } from '#cli/tools/pins.ts';
import { readLintRuleExplanation } from '#cli/tools/rules.ts';
import type { Check } from '#cli/types/manifests.ts';
import type { RuleExplanation, RuleExplanationOptions, Session } from '#cli/types/tools.ts';

/**
Read the explanation of a rule from its built-in check or installed tool.

@param root the repository whose tool installation supplies external documentation.
@param check the shipped check that reports the rule.
@param identifier the complete rule ID.
@param session the selected tools and process timeout, when the repository has settings.
*/
export async function readCheckRuleExplanation(
    root: string,
    check: Check,
    identifier: string,
    session?: Session,
): Promise<RuleExplanation | undefined> {
    const explanations = selectCheckCode(check)?.explanations;
    if (explanations !== undefined)
        return Object.hasOwn(explanations, identifier) ? explanations[identifier] : undefined;
    const tool = OUTPUT_FORMATS[check.output.format].namesRules(check.output) ? findToolName(check) : undefined;
    if (tool === undefined) return undefined;
    const options: RuleExplanationOptions = { help: check.help };
    if (session !== undefined) {
        options.timeoutSeconds = session.settings.tool_timeout_seconds;
        options.readMiseBinPaths = async () => {
            const { folders } = await readToolBinPaths(session);
            return folders;
        };
    }
    return await readLintRuleExplanation(root, tool, identifier, options);
}
