import { formatIgnoreSubject, readEditContext, writeSettingsEdit } from '#cli/commands/edits.ts';
import { IGNORE_CHECK_MESSAGE } from '#cli/config/commands/edits.ts';
import { PATHS_OPTION, REASON_OPTION, RULE_OPTION } from '#cli/config/commands/help.ts';
import { EVERY_CHECK } from '#cli/config/configurations/gspot.ts';
import { RUFF_RULE_PREFIX } from '#cli/config/settings/schema.ts';
import { readListedRuleExplanation } from '#cli/configurations/lint-rules.ts';
import { selectCheckCode } from '#cli/configurations/registry.ts';
import { canIgnoreRule } from '#cli/engine/results.ts';
import { openSession } from '#cli/engine/session.ts';
import { assertCheckExists, findCheck, findToolName, listCheckIds } from '#cli/manifests/read.ts';
import { ignoreSchema } from '#cli/schemas/settings/file.ts';
import { mergeIgnore } from '#cli/settings/edit.ts';
import { buildArgumentPaths } from '#cli/settings/paths.ts';
import { validateReason } from '#cli/settings/validation/reasons.ts';
import { GspotError } from '#cli/system/errors.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { formatNameList, quoteArgument } from '#cli/system/text.ts';
import type { CommandDefinition, EditContext, IgnoreFlags, IgnoreOptions } from '#cli/types/commands.ts';
import type { Check } from '#cli/types/manifests.ts';
import type { TomlTable } from '#cli/types/settings.ts';
import type { CommandResult } from '#cli/types/system.ts';
import type { Session } from '#cli/types/tools.ts';

function formatIgnoreSummary(options: IgnoreOptions, paths: string[] | undefined): string {
    const target = formatIgnoreSubject(options.check ?? EVERY_CHECK, options.rule);
    const suffix = paths === undefined ? '' : ` for ${formatNameList(paths)}`;
    return `Ignored ${target}${suffix}.`;
}

function findRuleCheck({ settings }: Session, checkId: string): Check {
    const check = findCheck(checkId, settings.commandChecks)?.check;
    if (check === undefined || !canIgnoreRule(check, selectCheckCode(check)))
        throw new GspotError(
            'arguments',
            `gspot cannot ignore one lint rule of ${checkId}. Leave out --rule, and give --paths to ignore the check for those files.`,
        );
    return check;
}

async function assertDocumentedRule(
    session: Session,
    { checkId, rule }: { checkId: string; rule: string },
): Promise<void> {
    const check = findRuleCheck(session, checkId);
    if (findToolName(check) === 'ruff' && RUFF_RULE_PREFIX.test(rule)) return;
    await readListedRuleExplanation(session.root, check, rule, session);
}

function assertNoCheckPaths(context: EditContext, paths: string[]): void {
    const checks = new Set(listCheckIds(Object.values(context.settings.commandChecks)));
    for (const path of paths)
        if (checks.has(path))
            throw new GspotError(
                'arguments',
                `--paths ${quoteArgument(path)} names a check. Give the check as a positional argument.`,
            );
}

function assertSelectorsMatch(context: EditContext, selectors: string[]): void {
    for (const selector of selectors) {
        const path = selector.startsWith('!') ? selector.slice(1) : selector;
        const isMatched = buildPathMatcher([path]);
        if (
            context.listing.files.every(
                (file) => file.path !== path && !file.path.startsWith(`${path}/`) && !isMatched(file.path),
            )
        )
            throw new GspotError(
                'arguments',
                `--paths ${quoteArgument(selector)} matches no repository file. Name an existing file, folder, or matching glob.`,
            );
    }
}

function buildIgnorePaths(context: EditContext, cwd: string, paths: string[] | undefined): string[] | undefined {
    assertNoCheckPaths(context, paths ?? []);
    const selectors = buildArgumentPaths(context.root, cwd, paths);
    assertSelectorsMatch(context, selectors ?? []);
    return selectors;
}

async function runIgnoreCommand(options: IgnoreOptions): Promise<CommandResult> {
    const context = await readEditContext(options.root);
    const { root, file, settings, cache, listing } = context;
    if (options.check !== undefined) assertCheckExists(options.check, Object.values(settings.commandChecks));
    if (options.rule !== undefined && options.check !== undefined) {
        const session = await openSession(root, { settings, cache, listing });
        await assertDocumentedRule(session, { checkId: options.check, rule: options.rule });
    }
    const paths = buildIgnorePaths(context, options.cwd, options.paths);
    const list = (file.table['ignore'] as TomlTable[] | undefined) ?? [];
    mergeIgnore(list, {
        ...(options.check !== undefined && { check: options.check }),
        ...(options.rule !== undefined && { rule: options.rule }),
        paths,
        reason: options.reason,
    });
    file.table['ignore'] = list;
    return await writeSettingsEdit(context, { summary: formatIgnoreSummary(options, paths) });
}

export const IGNORE_COMMAND: CommandDefinition<[string | undefined], IgnoreFlags, Omit<IgnoreOptions, 'root'>> = {
    name: 'ignore',
    arguments: [{ term: '[check]' }],
    options: [{ flags: REASON_OPTION, required: true }, { flags: RULE_OPTION }, { flags: PATHS_OPTION, repeats: true }],
    parse: ({ arguments: commandArguments, flags: { reason, rule, paths }, cwd }) => {
        const [check] = commandArguments;
        const message = validateReason(`gspot ignore ${check ?? ''}`.trimEnd(), reason, IGNORE_CHECK_MESSAGE);
        if (message !== undefined) throw new GspotError('arguments', message);
        const valid = ignoreSchema.safeParse({ check, rule, paths, reason });
        if (!valid.success)
            throw new GspotError(
                'arguments',
                valid.error.issues.map((issue) => `--${issue.path.join('.')}: ${issue.message}`).join('\n'),
            );
        return { cwd, check, paths, rule, reason };
    },
    run: runIgnoreCommand,
};
