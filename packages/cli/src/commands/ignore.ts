import { GspotError } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/tools.ts';
import { mergeIgnore } from '#cli/settings/text.ts';
import { formatNameList } from '#cli/system/text.ts';
import type { TomlTable } from '#cli/types/settings.ts';
import type { CommandResult } from '#cli/types/system.ts';
import { CHECK_CODE } from '#cli/configurations/registry.ts';
import { ignoreSchema } from '#cli/schemas/settings/file.ts';
import { hasRuleOutput } from '#cli/engine/outputs/formats.ts';
import { readCheckRuleDocs } from '#cli/configurations/rules.ts';
import { IGNORE_CHECK_MESSAGE } from '#cli/config/commands/edits.ts';
import { validateReason } from '#cli/settings/validation/reasons.ts';
import { EVERY_CHECK, RULE_OPTION, REASON_OPTION } from '#cli/config/commands/help.ts';
import { listChecksById, assertCheckExists, readConfigurations } from '#cli/manifests/read.ts';
import type { IgnoreFlags, IgnoreOptions, CommandDefinition } from '#cli/types/commands/edits.ts';
import { pathsOption, buildIgnorePaths, writeSettingsEdit, readSettingsEditContext } from '#cli/commands/edits.ts';

function formatIgnoreSummary(options: IgnoreOptions, paths: string[] | undefined): string {
    const check = options.check ?? EVERY_CHECK;
    const target = options.rule === undefined ? check : `rule ${options.rule} of ${check}`;
    const suffix = paths === undefined ? '' : ` for ${formatNameList(paths)}`;
    return `Ignored ${target}${suffix}.`;
}

async function assertDocumentedRule(
    session: Session,
    { checkId, rule }: { checkId: string; rule: string },
): Promise<void> {
    const { root, settings } = session;
    const shippedCheck = listChecksById(readConfigurations().values()).get(checkId)?.check;
    const check = settings.commandChecks[checkId] ?? shippedCheck;
    if (check === undefined || (!hasRuleOutput(check) && CHECK_CODE[checkId]?.ruleDocs === undefined))
        throw new GspotError('arguments', `${checkId} does not report lint rules. Omit --rule.`);
    const docs = await readCheckRuleDocs(root, check, rule, session);
    if (docs === undefined) throw new GspotError('arguments', `gspot does not know rule ${rule} of ${checkId}.`);
}

async function runIgnoreCommand(options: IgnoreOptions): Promise<CommandResult> {
    const record = {
        check: options.check,
        rule: options.rule,
        paths: options.paths,
        reason: options.reason,
    };
    const valid = ignoreSchema.safeParse(record);
    if (!valid.success)
        throw new GspotError(
            'arguments',
            valid.error.issues.map((issue) => `--${issue.path.join('.')}: ${issue.message}`).join('\n'),
        );
    const context = await readSettingsEditContext(options.root);
    const { root, edit: input, settings } = context;
    if (options.check !== undefined) assertCheckExists(options.check, Object.values(settings.commandChecks));
    if (options.rule !== undefined && options.check !== undefined)
        await assertDocumentedRule(context.session, { checkId: options.check, rule: options.rule });
    const paths = buildIgnorePaths(context, options.cwd, options.paths);
    const list = (input.table['ignore'] as TomlTable[] | undefined) ?? [];
    mergeIgnore(list, {
        ...(options.check !== undefined && { check: options.check }),
        ...(options.rule !== undefined && { rule: options.rule }),
        paths,
        reason: options.reason,
    });
    input.table['ignore'] = list;
    return await writeSettingsEdit(root, {
        cache: context.cache,
        listing: context.listing,
        edit: input,
        summary: formatIgnoreSummary(options, paths),
    });
}

export const ignoreCommand: CommandDefinition<[string | undefined], IgnoreFlags> = {
    name: 'ignore',
    arguments: [{ term: '[check]' }],
    options: [{ flags: REASON_OPTION, required: true }, { flags: RULE_OPTION }, pathsOption],
    run: async ([check], { reason, rule, paths }, { root, cwd }) => {
        const message = validateReason(`gspot ignore ${check ?? ''}`.trimEnd(), reason, IGNORE_CHECK_MESSAGE);
        if (message !== undefined) throw new GspotError('arguments', message);
        return await runIgnoreCommand({ root, cwd, check, paths, rule, reason });
    },
};
