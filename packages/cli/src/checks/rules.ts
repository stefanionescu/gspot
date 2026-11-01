import { findToolName } from '#cli/tools/pins.ts';
import { CHECK_CODE } from '#cli/checks/registry.ts';
import type { Check } from '#cli/types/manifests.ts';
import type { Session } from '#cli/types/session.ts';
import { readLintRuleDocs } from '#cli/tools/rules.ts';
import { readToolBinPaths } from '#cli/tools/locate.ts';
import { hasRuleOutput } from '#cli/runs/output/formats.ts';
import { buildMiseInstall } from '#cli/tools/installers/mise.ts';
import type { LintRuleDocs, RuleDocsOptions } from '#cli/types/tools/tools.ts';

/**
Read a documented rule from its built-in check or installed tool.

@param root the repository whose tool installation supplies external documentation.
@param check the shipped check that reports the rule.
@param identifier the complete rule ID.
@param session the selected tools and process timeout, when the repository has settings.
*/
export async function readCheckRuleDocs(
    root: string,
    check: Check,
    identifier: string,
    session?: Session,
): Promise<LintRuleDocs | undefined> {
    const ruleDocs = CHECK_CODE[check.id]?.ruleDocs;
    if (ruleDocs !== undefined) return Object.hasOwn(ruleDocs, identifier) ? ruleDocs[identifier] : undefined;
    const tool = hasRuleOutput(check) ? findToolName(check) : undefined;
    if (tool === undefined) return undefined;
    const options: RuleDocsOptions = {};
    if (session !== undefined) {
        options.timeoutSeconds = session.timeoutSeconds;
        options.readMiseBinPaths = () =>
            readToolBinPaths(session, buildMiseInstall(session.toolConfigurations).content);
    }
    return await readLintRuleDocs(root, tool, identifier, options);
}
