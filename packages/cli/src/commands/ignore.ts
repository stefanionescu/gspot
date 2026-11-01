import { GspotError } from '#cli/system/errors.ts';
import { mergeIgnore } from '#cli/settings/text.ts';
import { EVERY_CHECK } from '#cli/config/ignores.ts';
import type { Session } from '#cli/types/session.ts';
import { type Command } from '@commander-js/extra-typings';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { CHECK_CODE } from '#cli/configurations/registry.ts';
import { ignoreSchema } from '#cli/schemas/settings/file.ts';
import { hasRuleOutput } from '#cli/engine/outputs/formats.ts';
import { readCheckRuleDocs } from '#cli/configurations/rules.ts';
import type { TomlTable } from '#cli/types/settings/settings.ts';
import { validateReason } from '#cli/settings/validation/reasons.ts';
import type { CommandResult, CommandCompletion } from '#cli/types/terminal.ts';
import { type IgnoreOptions, type CommandLocation } from '#cli/types/commands/commands.ts';
import { listChecksById, assertCheckExists, readConfigurations } from '#cli/manifests/read.ts';
import { buildIgnorePaths, writeSettingsEdit, readSettingsEditContext } from '#cli/commands/edits.ts';
import { RULE_OPTION, PATHS_OPTION, REASON_OPTION, IGNORE_CHECK_MESSAGE } from '#cli/config/commands/commands.ts';

function formatIgnoreSummary(options: IgnoreOptions, paths: string[] | undefined): string {
    const check = options.check ?? EVERY_CHECK;
    const target = options.rule === undefined ? check : `rule ${options.rule} of ${check}`;
    const suffix = paths === undefined ? '' : ` for ${paths.join(' and ')}`;
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

/**
Register the ignore command.

@param program the gspot program that gets the command.
@param onResult receives the result of the command.
@param location the calling folder and the Git root validated before the action.
*/
export function registerIgnore(program: Command, onResult: CommandCompletion, location: CommandLocation): void {
    program
        .command('ignore')
        .argument('[check]', COMMAND_HELP.ignore.arguments['check'])
        .summary(COMMAND_HELP.ignore.summary)
        .description(COMMAND_HELP.ignore.description)
        .requiredOption(REASON_OPTION, COMMAND_HELP.ignore.options[REASON_OPTION])
        .option(RULE_OPTION, COMMAND_HELP.ignore.options[RULE_OPTION])
        .option(
            PATHS_OPTION,
            COMMAND_HELP.ignore.options[PATHS_OPTION],
            (value: string, previous: string[] | undefined) => [...(previous ?? []), value],
        )
        .action(async (check, flags) => {
            const message = validateReason(`gspot ignore ${check ?? ''}`.trimEnd(), flags.reason, IGNORE_CHECK_MESSAGE);
            if (message !== undefined) throw new GspotError('arguments', message);
            onResult(
                await runIgnoreCommand({
                    root: location.root,
                    cwd: location.cwd,
                    check,
                    paths: flags.paths,
                    rule: flags.rule,
                    reason: flags.reason,
                }),
            );
        });
}
