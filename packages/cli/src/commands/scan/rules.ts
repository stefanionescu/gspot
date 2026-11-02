import { compareRules, readPrintedRules } from '#cli/generation/setup/lint-rules.ts';
import type { RuleRead, CarryoverRow, InitPlanning } from '#cli/types/generation.ts';

import {
    CARRY_ROW_START,
    RULE_PRINT_FLAG,
    PRINTED_RULE_TOOLS,
    NOT_COMPARED_MESSAGE,
} from '#cli/config/repository/setup.ts';

/**
Read the rules that the ESLint and Stylelint of the repository resolve. Call this before init replaces their configs.

@param planning the plan of init in the copy.
@returns one read per replaced config, with the file that gspot asks each side about.
*/
export async function readUserRules(planning: InitPlanning): Promise<RuleRead[]> {
    const { detection, session } = planning;
    const { root, repository, toolConfigurations } = session;
    const tools = new Set(toolConfigurations.flatMap((configuration) => configuration.tools.map(({ name }) => name)));
    const reads = PRINTED_RULE_TOOLS.flatMap((definition) => {
        const config = detection.repositorySetup.conflictingConfigs.find(
            ({ tool, shared }) => tool === definition.tool && !shared,
        );
        const sample = repository.files.find(({ path }) => definition.sample.test(path))?.path;
        if (config === undefined || sample === undefined || !tools.has(definition.tool)) return [];
        return [{ definition, path: config.path, sample }];
    });
    return await Promise.all(
        reads.map(async (read) => ({
            ...read,
            user: await readPrintedRules({
                root,
                tool: read.definition.tool,
                search: { folders: [root] },
                commandArguments: [RULE_PRINT_FLAG, read.sample],
                hasSeverity: read.definition.hasSeverity,
            }),
        })),
    );
}

/**
Compare the rules of each replaced config with the rules that the installed tools of gspot resolve.

@param root the copy with the generated configs and the installed tools.
@param reads what readUserRules returned.
@returns one row per replaced config.
*/
export async function compareInstalledRules(root: string, reads: RuleRead[]): Promise<CarryoverRow[]> {
    return await Promise.all(
        reads.map(async ({ definition, path, sample, user }): Promise<CarryoverRow> => {
            const { tool, check, hasSeverity, gspotArguments } = definition;
            const shipped = await readPrintedRules({
                root,
                tool,
                search: { folders: [], toolFolderKind: 'npm' },
                commandArguments: [...gspotArguments, RULE_PRINT_FLAG, sample],
                hasSeverity,
            });
            if (user === undefined || shipped === undefined)
                return { ...CARRY_ROW_START, path, tool, dropped: [NOT_COMPARED_MESSAGE] };
            const compared = compareRules({ check, user, lookup: (rule) => shipped.get(rule) });
            const added = Map.groupBy(compared.added, (rule) => rule.includes('/'));
            return {
                ...CARRY_ROW_START,
                path,
                tool,
                covered: compared.covered,
                differing: [...compared.options].map(([rule, options]) => `${rule} ${JSON.stringify(options)}`),
                reasons: compared.reasons,
                plugins: (added.get(true) ?? []).map((rule) => `${rule} ${JSON.stringify(user.get(rule)?.options)}`),
                commandChecks: added.get(false) ?? [],
            };
        }),
    );
}
