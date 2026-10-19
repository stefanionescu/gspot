import { GspotError } from '#cli/system/errors.ts';
import { stripUndefined } from '#cli/system/values.ts';
import { mergeIgnore } from '#cli/settings/write/text.ts';
import { type Command } from '@commander-js/extra-typings';
import { saveSettings } from '#cli/apply/save-settings.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { type TomlTable } from '#cli/types/settings/file.ts';
import type { Settings } from '#cli/types/settings/values.ts';
import { stringify, LocalDate } from '@decimalturn/toml-patch';
import { startSettingsEdit } from '#cli/commands/edit-settings.ts';
import { calendarDateSchema } from '#cli/settings/schema/parts.ts';
import { assertKnownCheck } from '#cli/configurations/manifests.ts';
import { validateReason } from '#cli/settings/validation/reasons.ts';
import { type IgnoreOptions } from '#cli/types/commands/edit-settings.ts';
import { type CommandResult, type CommandCompletion } from '#cli/types/terminal.ts';

// An ignore names a known check, or no check and the paths that every check skips.
function assertIgnoreTarget(options: IgnoreOptions, settings: Settings, reads: ReadCache): void {
    if (options.check !== undefined) {
        assertKnownCheck(options.check, settings, reads);
        return;
    }
    if (options.paths === undefined)
        throw new GspotError(
            'settings',
            'An ignore without a check needs --paths. Name the paths to keep out of every check.',
        );
    if (options.rule !== undefined)
        throw new GspotError(
            'settings',
            'An ignore without a check cannot take --rule. Name the check that owns the rule.',
        );
}

/**
 * Write an ignore with its reason.
 * @param options the parsed flags.
 * @returns the command result.
 */
async function runIgnoreCommand(options: IgnoreOptions): Promise<CommandResult> {
    const { root, input, settings, reads } = startSettingsEdit(options.cwd);
    assertIgnoreTarget(options, settings, reads);
    const target = options.check ?? 'every check';
    const message = validateReason(`gspot ignore ${options.check ?? ''}`.trimEnd(), options.reason);
    if (message !== undefined) throw new GspotError('settings', message);
    const list = (input.table['ignore'] as TomlTable[] | undefined) ?? [];
    let saved: TomlTable = {};
    const result = await saveSettings(root, {
        input,
        change: (written) => {
            saved = mergeIgnore(
                list,
                stripUndefined({
                    check: options.check,
                    rule: options.rule,
                    names: options.names,
                    paths: options.paths,
                    reason: options.reason,
                    until: options.until === undefined ? undefined : parseExpiryDate(options.until),
                }),
            );
            written['ignore'] = list;
        },
        summary: `Ignored ${target}${options.paths === undefined ? '' : ' for ' + options.paths.join(' and ')}.`,
    });
    const written = stringify({ ignore: [saved] }).trimEnd();
    return result.exitCode === 0 && result.json.changed ? { ...result, text: `${written}\n${result.text}` } : result;
}

/**
 * Register the ignore command.
 * @param program the CLI that gets the command.
 * @param onResult writes the command result.
 */
function registerIgnore(program: Command, onResult: CommandCompletion): void {
    program
        .command('ignore')
        .argument('[check]', COMMAND_HELP.ignore.arguments['check'])
        .summary(COMMAND_HELP.ignore.summary)
        .description(COMMAND_HELP.ignore.description)
        .requiredOption('--reason <text>', COMMAND_HELP.ignore.options['--reason <text>'])
        .option('--rule <rule>', COMMAND_HELP.ignore.options['--rule <rule>'])
        .option('--names <names...>', COMMAND_HELP.ignore.options['--names <names...>'])
        .option('--paths <glob...>', COMMAND_HELP.ignore.options['--paths <glob...>'])
        .option('--until <date>', COMMAND_HELP.ignore.options['--until <date>'])
        .action(async (check, flags) => {
            onResult(
                await runIgnoreCommand({
                    cwd: process.cwd(),
                    ...stripUndefined({
                        check,
                        paths: flags.paths,
                        rule: flags.rule,
                        names: flags.names,
                        reason: flags.reason,
                        until: flags.until,
                    }),
                }),
            );
        });
}

/**
 * Validate the --until date before writing it.
 * @param text the date from --until.
 * @returns the same calendar date as a TOML value.
 */
function parseExpiryDate(text: string): LocalDate {
    const result = calendarDateSchema.safeParse(text);
    if (!result.success) throw new GspotError('settings', 'until must be a valid calendar date in YYYY-MM-DD form.');
    return new LocalDate(result.data);
}

export { registerIgnore };
