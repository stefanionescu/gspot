import { selectCheckCode } from '#cli/configurations/registry.ts';
import { OUTPUT_FORMATS } from '#cli/engine/outputs/formats.ts';
import { findToolName, readShippedChecks } from '#cli/manifests/read.ts';
import { isConfigurationSelected } from '#cli/manifests/select.ts';
import { GspotError } from '#cli/system/errors.ts';
import { readToolBinPaths } from '#cli/tools/locate.ts';
import { readLintRuleExplanation } from '#cli/tools/rule-explanations.ts';
import type { Check } from '#cli/types/manifests.ts';
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
    return await readLintRuleExplanation(root, tool, identifier, options).catch((error: unknown) =>
        rethrowForUnselectedCheck(error, check, session),
    );
}
