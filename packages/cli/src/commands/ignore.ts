import { join } from 'node:path';
import { statSync } from 'node:fs';
import { escapeGlob } from '#cli/system/paths.ts';
import { GspotError } from '#cli/system/errors.ts';
import { mergeIgnore } from '#cli/settings/text.ts';
import { EVERY_CHECK } from '#cli/config/ignores.ts';
import { type Command } from '@commander-js/extra-typings';
import { assertCheckExists } from '#cli/manifests/read.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { buildArgumentPaths } from '#cli/settings/paths.ts';
import { ignoreSchema } from '#cli/schemas/settings/file.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import type { IgnoreOptions } from '#cli/types/commands/ignore.ts';
import { validateReason } from '#cli/settings/validation/reasons.ts';
import type { CommandResult, CommandCompletion } from '#cli/types/terminal.ts';
import { GLOB_BRACKETS, IGNORE_CHECK_MESSAGE } from '#cli/config/commands/ignore.ts';
import { RULE_OPTION, PATHS_OPTION, REASON_OPTION } from '#cli/config/commands/flags.ts';
import { writeSettingsEdit, readSettingsEditContext } from '#cli/generation/settings-edit.ts';

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
    const context = await readSettingsEditContext(options.cwd);
    const { root, edit: input, settings } = context;
    if (options.check !== undefined) assertCheckExists(options.check, settings);
    const paths = escapeLiteralPaths(root, buildArgumentPaths(root, options.cwd, options.paths));
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
        .action(async (check, flags) => {
            const message = validateReason(`gspot ignore ${check ?? ''}`.trimEnd(), flags.reason, IGNORE_CHECK_MESSAGE);
            if (message !== undefined) throw new GspotError('arguments', message);
            onResult(
                await runIgnoreCommand({
                    cwd: process.cwd(),
                    check,
                    paths: flags.paths,
                    rule: flags.rule,
                    reason: flags.reason,
                }),
            );
        });
}
