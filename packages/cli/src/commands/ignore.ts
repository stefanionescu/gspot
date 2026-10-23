import { join } from 'node:path';
import { statSync } from 'node:fs';
import { GspotError } from '#cli/system/errors.ts';
import { stripUndefined } from '#cli/system/tables.ts';
import { mergeIgnore } from '#cli/settings/text/build.ts';
import { type Command } from '@commander-js/extra-typings';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { BACKSLASH_BEFORE_MATCH } from '#cli/config/text.ts';
import { LocalDate, stringify } from '@decimalturn/toml-patch';
import { GLOB_BRACKETS } from '#cli/config/commands/ignore.ts';
import { type IgnoreOptions } from '#cli/types/commands/ignore.ts';
import { assertCheckExists } from '#cli/configurations/manifests.ts';
import { calendarDateSchema } from '#cli/schemas/settings/fields.ts';
import { validateReason } from '#cli/settings/validation/reasons.ts';
import { type Settings, type TomlTable } from '#cli/types/settings/file.ts';
import { GLOB_SPECIAL_CHARACTERS } from '#cli/config/files/path-patterns.ts';
import { applySettingsEdit, prepareSettingsEdit } from '#cli/apply/settings.ts';
import { type CommandResult, type CommandCompletion } from '#cli/types/terminal.ts';

function assertIgnoreOptions(options: IgnoreOptions, settings: Settings): void {
    if (options.check !== undefined) {
        assertCheckExists(options.check, settings);
        return;
    }
    if (options.paths === undefined)
        throw new GspotError(
            'arguments',
            'An ignore without a check needs --paths. Name the paths to keep out of every check.',
        );
    if (options.rule !== undefined)
        throw new GspotError(
            'arguments',
            'An ignore without a check cannot take --rule. Name the check that owns the rule.',
        );
}

function escapeLiteralPaths(root: string, paths: string[] | undefined): string[] | undefined {
    return paths?.map((path) => {
        const segments = path.split('/');
        for (let index = segments.length; index > 0; index -= 1) {
            const prefix = segments.slice(0, index).join('/');
            if (!GLOB_BRACKETS.test(prefix)) return path;
            if (statSync(join(root, prefix), { throwIfNoEntry: false }) !== undefined)
                return [
                    prefix.replaceAll(GLOB_SPECIAL_CHARACTERS, BACKSLASH_BEFORE_MATCH),
                    ...segments.slice(index),
                ].join('/');
        }
        return path;
    });
}

async function runIgnoreCommand(options: IgnoreOptions): Promise<CommandResult> {
    const { root, input, settings } = prepareSettingsEdit(options.cwd);
    assertIgnoreOptions(options, settings);
    const paths = escapeLiteralPaths(root, options.paths);
    const target = options.check ?? 'every check';
    const message = validateReason(`gspot ignore ${options.check ?? ''}`.trimEnd(), options.reason);
    if (message !== undefined) throw new GspotError('settings', message);
    const list = (input.table['ignore'] as TomlTable[] | undefined) ?? [];
    const saved = mergeIgnore(
        list,
        stripUndefined({
            check: options.check,
            rule: options.rule,
            names: options.names,
            paths,
            reason: options.reason,
            until: options.until === undefined ? undefined : parseExpiryDate(options.until),
        }),
    );
    input.table['ignore'] = list;
    const result = await applySettingsEdit(root, {
        edit: input,
        summary: `Ignored ${target}${paths === undefined ? '' : ' for ' + paths.join(' and ')}.`,
    });
    const record = stringify({ ignore: [saved] }).trimEnd();
    return result.json.changed ? { ...result, text: `${record}\n${result.text}` } : result;
}

function parseExpiryDate(text: string): LocalDate {
    const result = calendarDateSchema.safeParse(text);
    if (!result.success)
        throw new GspotError('arguments', '--until needs a calendar date in YYYY-MM-DD form, such as 2027-01-31.');
    return new LocalDate(result.data);
}

/**
 * Register the ignore command.
 *
 * @param program the gspot program that gets the command.
 * @param onResult receives the result of the command.
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: main.ts registers the command through it, like every other command.
export function registerIgnore(program: Command, onResult: CommandCompletion): void {
    program
        .command('ignore')
        .argument('[check]', COMMAND_HELP.ignore.arguments['check'])
        .summary(COMMAND_HELP.ignore.summary)
        .description(COMMAND_HELP.ignore.description)
        .requiredOption('--reason <text>', COMMAND_HELP.ignore.options['--reason <text>'])
        .option('--rule <rule>', COMMAND_HELP.ignore.options['--rule <rule>'])
        .option('--names <names...>', COMMAND_HELP.ignore.options['--names <names...>'])
        .option('--paths <path...>', COMMAND_HELP.ignore.options['--paths <path...>'])
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
