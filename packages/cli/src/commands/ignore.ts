import { GspotError } from '#cli/system/errors.ts';
import { LocalDate } from '@decimalturn/toml-patch';
import { quoteArgument } from '#cli/system/text.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { printResult } from '#cli/system/terminal.ts';
import { stripUndefined } from '#cli/system/values.ts';
import { type Command } from '@commander-js/extra-typings';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { type ReadCache } from '#cli/types/system/files.ts';
import { type CommandResult } from '#cli/types/terminal.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { type TomlTable } from '#cli/types/settings/file.ts';
import { type Settings } from '#cli/types/settings/values.ts';
import { calendarDateSchema } from '#cli/settings/schema/parts.ts';
import { validateReason } from '#cli/settings/validation/reasons.ts';
import { type IgnoreOptions } from '#cli/types/commands/save-settings.ts';
import { mergeIgnore, formatSettingsText } from '#cli/settings/write/text.ts';
import { saveSettings, startSettingsEdit } from '#cli/commands/save-settings.ts';
import { listCheckIds, formatUnknownCheck } from '#cli/configurations/manifests.ts';

function assertKnownCheck(checkName: string, settings: Settings, reads: ReadCache): void {
    const known = listCheckIds(Object.values(settings.check), reads);
    if (known.includes(checkName)) return;
    throw new GspotError('arguments', formatUnknownCheck(checkName, known));
}

function buildReasonHint(options: IgnoreOptions): string {
    const rule = options.rule === undefined ? '' : ` --rule ${quoteArgument(options.rule)}`;
    const paths =
        options.paths === undefined ? '' : ` --paths ${options.paths.map((path) => quoteArgument(path)).join(' ')}`;
    return `gspot ignore ${quoteArgument(options.check)}${rule}${paths} --reason "..."`;
}

/**
 * Write an ignore with its reason.
 * @param options the parsed flags
 * @returns the command result
 */
async function ignoreCommand(options: IgnoreOptions): Promise<CommandResult> {
    const { root, input } = await startSettingsEdit(options.cwd);
    const reads = createReadCache(root);
    const settings = parseSettings(input.text, root, reads);
    assertKnownCheck(options.check, settings, reads);
    const diagnostic = validateReason(`gspot ignore ${options.check}`, options.reason, buildReasonHint(options));
    if (diagnostic !== undefined) throw new GspotError('settings', diagnostic);
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
                    paths: options.paths,
                    reason: options.reason,
                    until: options.until === undefined ? undefined : parseExpiryDate(options.until),
                }),
            );
            written['ignore'] = list;
        },
        summary: `Saved the ignore for ${options.check}.`,
    });
    const written = formatSettingsText('', { ignore: [saved] }).trimEnd();
    return result.exitCode === 0 && result.json.changed ? { ...result, text: `${written}\n${result.text}` } : result;
}

/**
 * Register the ignore command.
 * @param program the command program
 */
function registerIgnore(program: Command): void {
    program
        .command('ignore')
        .argument('<check>', COMMAND_HELP.ignore.arguments['check'])
        .summary(COMMAND_HELP.ignore.summary)
        .description(COMMAND_HELP.ignore.description)
        .requiredOption('--reason <text>', COMMAND_HELP.ignore.options['--reason <text>'])
        .option('--rule <rule>', COMMAND_HELP.ignore.options['--rule <rule>'])
        .option('--paths <glob...>', COMMAND_HELP.ignore.options['--paths <glob...>'])
        .option('--until <date>', COMMAND_HELP.ignore.options['--until <date>'])
        .action(async (check, flags) => {
            printResult(
                await ignoreCommand({
                    cwd: process.cwd(),
                    check,
                    ...stripUndefined({
                        paths: flags.paths,
                        rule: flags.rule,
                        reason: flags.reason,
                        until: flags.until,
                    }),
                }),
            );
        });
}

/**
 * Validate a CLI expiry argument before creating its written value.
 * @param text the date supplied to --until
 * @returns the same calendar date as a TOML value
 */
function parseExpiryDate(text: string): LocalDate {
    const result = calendarDateSchema.safeParse(text);
    if (!result.success) throw new GspotError('settings', 'until must be a valid calendar date in YYYY-MM-DD form.');
    return new LocalDate(result.data);
}

export { parseExpiryDate };
export { registerIgnore };
