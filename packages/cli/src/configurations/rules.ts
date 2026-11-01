import { findToolName } from '#cli/tools/pins.ts';
import type { Check } from '#cli/types/manifests.ts';
import { readLintRuleDocs } from '#cli/tools/rules.ts';
import { readToolBinPaths } from '#cli/tools/locate.ts';
import { CHECK_CODE } from '#cli/configurations/registry.ts';
import { OUTPUT_FORMATS } from '#cli/engine/outputs/formats.ts';
import type { Session, LintRuleDocs, RuleDocsOptions } from '#cli/types/tools.ts';

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
    const tool = OUTPUT_FORMATS[check.output.format].namesRules(check.output) ? findToolName(check) : undefined;
    if (tool === undefined) return undefined;
    const options: RuleDocsOptions = {};
    if (session !== undefined) {
        options.timeoutSeconds = session.settings.tool_timeout_seconds;
        options.readMiseBinPaths = async () => {
            const { folders } = await readToolBinPaths(session);
            return folders;
        };
    }
    return await readLintRuleDocs(root, tool, identifier, options);
}
