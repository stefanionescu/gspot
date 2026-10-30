import { join } from 'node:path';
import { statSync } from 'node:fs';
import { escapeGlob } from '#cli/system/paths.ts';
import { GspotError } from '#cli/system/errors.ts';
import { LocalDate } from '@decimalturn/toml-patch';
import { mergeIgnore } from '#cli/settings/text.ts';
import { EVERY_CHECK } from '#cli/config/ignores.ts';
import { stripUndefined } from '#cli/system/tables.ts';
import { type Command } from '@commander-js/extra-typings';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { buildArgumentPaths } from '#cli/settings/paths.ts';
import { ignoreSchema } from '#cli/schemas/settings/file.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import type { IgnoreOptions } from '#cli/types/commands/ignore.ts';
import { assertCheckExists } from '#cli/configurations/manifests.ts';
import { calendarDateSchema } from '#cli/schemas/settings/fields.ts';
import { validateReason } from '#cli/settings/validation/reasons.ts';
import { ISO_DATE_LENGTH } from '#cli/config/checks/general/gspot.ts';
import type { CommandResult, CommandCompletion } from '#cli/types/terminal.ts';
import { RULE_OPTION, PATHS_OPTION, REASON_OPTION } from '#cli/config/commands/flags.ts';
import { applySettingsEdit, prepareSettingsEdit } from '#cli/generation/settings-edit.ts';

import {
    UNTIL_OPTION,
    GLOB_BRACKETS,
    PAST_UNTIL_MESSAGE,
    IGNORE_CHECK_MESSAGE,
    UNTIL_FORMAT_MESSAGE,
} from '#cli/config/commands/ignore.ts';

function escapeLiteralPaths(root: string, paths: string[] | undefined): string[] | undefined {
    return paths?.map((path) => {
        const segments = path.split('/');
        for (let index = segments.length; index > 0; index -= 1) {
            const prefix = segments.slice(0, index).join('/');
            if (!GLOB_BRACKETS.test(prefix)) return path;
            if (statSync(join(root, prefix), { throwIfNoEntry: false }) !== undefined)
                return [escapeGlob(prefix), ...segments.slice(index)].join('/');
        }
        return path;
    });
}

function formatIgnoreSummary(options: IgnoreOptions, paths: string[] | undefined): string {
    const check = options.check ?? EVERY_CHECK;
    const target = options.rule === undefined ? check : `rule ${options.rule} of ${check}`;
    const suffix = paths === undefined ? '' : ` for ${paths.join(' and ')}`;
    return `Ignored ${target}${suffix}.`;
}

async function runIgnoreCommand(options: IgnoreOptions): Promise<CommandResult> {
    const record = stripUndefined({
        check: options.check,
        rule: options.rule,
        paths: options.paths,
        reason: options.reason,
        until: options.until === undefined ? undefined : parseExpiryDate(options.until),
    });
    const valid = ignoreSchema.safeParse(record);
    if (!valid.success)
        throw new GspotError(
            'arguments',
            valid.error.issues.map((issue) => `--${issue.path.join('.')}: ${issue.message}`).join('\n'),
        );
    const context = await prepareSettingsEdit(options.cwd);
    const { root, edit: input, settings } = context;
    if (options.check !== undefined) assertCheckExists(options.check, settings);
    const paths = escapeLiteralPaths(root, buildArgumentPaths(root, options.cwd, options.paths));
    const list = (input.table['ignore'] as TomlTable[] | undefined) ?? [];
    mergeIgnore(
        list,
        stripUndefined({
            check: options.check,
            rule: options.rule,
            paths,
            reason: options.reason,
            until: options.until === undefined ? undefined : parseExpiryDate(options.until),
        }),
    );
    input.table['ignore'] = list;
    return await applySettingsEdit(root, {
        reads: context.reads,
        listing: context.listing,
        edit: input,
        summary: formatIgnoreSummary(options, paths),
    });
}

function parseExpiryDate(text: string): LocalDate {
    const result = calendarDateSchema.safeParse(text);
    if (!result.success) throw new GspotError('arguments', UNTIL_FORMAT_MESSAGE);
    if (result.data <= new Date().toISOString().slice(0, ISO_DATE_LENGTH))
        throw new GspotError('arguments', PAST_UNTIL_MESSAGE);
    return new LocalDate(result.data);
}

/**
Register the ignore command.

@param program the gspot program that gets the command.
@param onResult receives the result of the command.
*/
export function registerIgnore(program: Command, onResult: CommandCompletion): void {
    program
        .command('ignore')
        .argument('[check]', COMMAND_HELP.ignore.arguments['check'])
        .summary(COMMAND_HELP.ignore.summary)
        .description(COMMAND_HELP.ignore.description)
        .requiredOption(REASON_OPTION, COMMAND_HELP.ignore.options[REASON_OPTION])
        .option(RULE_OPTION, COMMAND_HELP.ignore.options[RULE_OPTION])
        .option(PATHS_OPTION, COMMAND_HELP.ignore.options[PATHS_OPTION])
        .option(UNTIL_OPTION, COMMAND_HELP.ignore.options[UNTIL_OPTION])
        .action(async (check, flags) => {
            const message = validateReason(`gspot ignore ${check ?? ''}`.trimEnd(), flags.reason, IGNORE_CHECK_MESSAGE);
            if (message !== undefined) throw new GspotError('arguments', message);
            onResult(
                await runIgnoreCommand({
                    cwd: process.cwd(),
                    ...stripUndefined({
                        check,
                        paths: flags.paths,
                        rule: flags.rule,
                        reason: flags.reason,
                        until: flags.until,
                    }),
                }),
            );
        });
}
