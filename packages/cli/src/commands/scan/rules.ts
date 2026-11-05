import {
    CARRYOVER_ROW_START,
    NOT_COMPARED_MESSAGE,
    PRINTED_RULE_TOOLS,
    REASON_PLACEHOLDER,
    RULE_PRINT_FLAG,
} from '#cli/config/repository/setup.ts';
import { compareRules, readPrintedRules } from '#cli/generation/setup/lint-rules.ts';
import { findText } from '#cli/system/files/reads.ts';
import { escapeRegExp, quoteArgument } from '#cli/system/text.ts';
import type { CarryoverRow, InitPlanning, RuleRead } from '#cli/types/generation.ts';

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
        return config === undefined || sample === undefined || !tools.has(definition.tool)
            ? []
            : [{ definition, path: config.path, text: findText(root, config.path) ?? '', sample }];
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
Compare the rules of each replaced config with the rules that the installed tools of gspot resolve. The printed rules
hold the shared configs that the file extends, so only a rule that the file itself names counts: a rule that a shared
config turns off is not the user's choice, and needs no reason.

@param root the copy with the generated configs and the installed tools.
@param reads what readUserRules returned.
@returns one row per replaced config.
*/
export async function compareInstalledRules(root: string, reads: RuleRead[]): Promise<CarryoverRow[]> {
    return await Promise.all(
        reads.map(async ({ definition, path, text, sample, user: printed }): Promise<CarryoverRow> => {
            const user =
                printed &&
                new Map(
                    [...printed].filter(([rule]) =>
                        new RegExp(String.raw`(?:^|[^\w@/-])${escapeRegExp(rule)}(?:[^\w/-]|$)`, 'mu').test(text),
                    ),
                );
            const { tool, check, hasSeverity, gspotArguments } = definition;
            const shipped = await readPrintedRules({
                root,
                tool,
                search: { folders: [], toolFolderKind: 'npm' },
                commandArguments: [...gspotArguments, RULE_PRINT_FLAG, sample],
                hasSeverity,
            });
            if (user === undefined || shipped === undefined)
                return { ...CARRYOVER_ROW_START, path, tool, dropped: [NOT_COMPARED_MESSAGE] };
            const compared = compareRules({ check, user, lookup: (rule) => shipped.get(rule) });
            const prefixes = new Set(shipped.keys().map((rule) => rule.slice(0, rule.lastIndexOf('/') + 1)));
            const added = Map.groupBy(
                compared.added,
                (rule) => rule.includes('/') && !prefixes.has(rule.slice(0, rule.lastIndexOf('/') + 1)),
            );
            return {
                ...CARRYOVER_ROW_START,
                path,
                tool,
                covered: compared.covered,
                differing: [...compared.options].map(([rule, options]) => `${rule} ${JSON.stringify(options)}`),
                reasons: compared.weakened.map(
                    (rule) => `gspot ignore ${check} --rule ${quoteArgument(rule)} --reason ${REASON_PLACEHOLDER}`,
                ),
                plugins: (added.get(true) ?? []).map((rule) => `${rule} ${JSON.stringify(user.get(rule)?.options)}`),
                commandChecks: added.get(false) ?? [],
            };
        }),
    );
}
