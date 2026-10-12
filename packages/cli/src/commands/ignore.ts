import { compact } from '#cli/objects.ts';
import { GspotError } from '#cli/errors.ts';
import { quoteArgument } from '#cli/text.ts';
import { printResult } from '#cli/terminal/print.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { type Command } from '@commander-js/extra-typings';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { type CommandResult } from '#cli/types/terminal.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { reasonError } from '#cli/settings/errors/reasons.ts';
import { type Settings } from '#cli/types/settings/values.ts';
import { knownChecks } from '#cli/configurations/manifests.ts';
import { type IgnoreOptions } from '#cli/types/commands/save-settings.ts';
import { unknownCheckMessage } from '#cli/configurations/unknown-names.ts';
import { saveSettings, startSettingsEdit } from '#cli/commands/save-settings.ts';
import { mergeIgnore, emitSettings, parseExpiryDate } from '#cli/settings/file.ts';

function assertKnownCheck(checkName: string, settings: Settings): void {
    const known = knownChecks(Object.values(settings.check));
    if (known.includes(checkName)) return;
    throw new GspotError('arguments', [unknownCheckMessage(checkName, known)]);
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
    const settings = parseSettings(input.text, root);
    assertKnownCheck(options.check, settings);
    const diagnostic = reasonError(`gspot ignore ${options.check}`, options.reason, buildReasonHint(options));
    if (diagnostic !== undefined) throw new GspotError('settings', diagnostic);
    const list = (input.table['ignore'] as TomlTable[] | undefined) ?? [];
    let saved: TomlTable = {};
    const result = await saveSettings(root, {
        input,
        change: (written) => {
            saved = mergeIgnore(
                list,
                compact({
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
    const written = emitSettings('', { ignore: [saved] }).trimEnd();
    return result.exitCode === 0 && result.json.changed ? { ...result, text: `${written}\n${result.text}` } : result;
}

/**
 * Register the ignore command.
 * @param program the command program
 */
export function registerIgnore(program: Command): void {
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
                    ...compact({ paths: flags.paths, rule: flags.rule, reason: flags.reason, until: flags.until }),
                }),
            );
        });
}
