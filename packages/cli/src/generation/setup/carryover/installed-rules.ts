import { posix } from 'node:path';
import { findText } from '#cli/system/files/reads.ts';
import { escapeRegExp } from '#cli/system/patterns.ts';
import { listToolNames } from '#cli/manifests/tools.ts';
import { quoteArgument } from '#cli/system/text/quoting.ts';
import type { RuleRead, CarryoverRow, InitPlanning } from '#cli/types/generation.ts';
import { compareRules, readPrintedRules } from '#cli/generation/setup/carryover/rules.ts';

import {
    IGNORE_FILES,
    RULE_PRINT_FLAG,
    PRINTED_RULE_TOOLS,
    REASON_PLACEHOLDER,
    CARRYOVER_ROW_START,
    NOT_COMPARED_MESSAGE,
    OTHER_CONFIG_MESSAGE,
} from '#cli/config/generation/setup.ts';

/**
Read the rules that the ESLint and Stylelint of the repository resolve. Call this before init replaces their configs.
Each tool reads one config, the first in the order of its manifest, which is the order in which the tool looks for
one. The read names the other configs of the tool, whose rules it does not hold.
*/
export async function readUserRules(planning: InitPlanning): Promise<RuleRead[]> {
    const { detection, session } = planning;
    const { root, repository, toolConfigurations } = session;
    const tools = listToolNames(toolConfigurations);
    const reads = PRINTED_RULE_TOOLS.flatMap((definition) => {
        const [config, ...others] = detection.repositorySetup.conflictingConfigs.filter(
            ({ tool, shared, path }) =>
                tool === definition.tool && !shared && IGNORE_FILES.every(({ file }) => posix.basename(path) !== file),
        );
        const sample = repository.files.find(({ path }) => definition.sample.test(path))?.path;
        if (config === undefined || sample === undefined || !tools.has(definition.tool)) return [];
        const { path } = config;
        return [
            { definition, path, others: others.map((other) => other.path), text: findText(root, path) ?? '', sample },
        ];
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
config turns off is not the user's choice, and needs no reason. Each other config of a tool gets a row that names the
config the tool read.
*/
export async function compareInstalledRules(root: string, reads: RuleRead[]): Promise<CarryoverRow[]> {
    const unread = reads.flatMap(({ definition: { tool }, path: read, others }) =>
        others.map((path): CarryoverRow => ({
            ...CARRYOVER_ROW_START,
            path,
            tool,
            dropped: [OTHER_CONFIG_MESSAGE.replace('<tool>', () => tool).replace('<path>', () => read)],
        })),
    );
    const compared = await Promise.all(
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
    return [...compared, ...unread];
}
