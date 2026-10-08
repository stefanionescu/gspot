import { COMMAND_HELP } from '#cli/config/commands/help.ts';

/**
 * Format the command's shared documentation for Commander.
 * @param name the registered command name
 * @returns levels, exit descriptions, and examples
 */
export function commandHelp(name: string): string {
    const help = COMMAND_HELP[name];
    if (help === undefined) throw new Error(`Command ${name} has no help metadata.`);
    return [
        ...(help.levels === undefined ? [] : ['\nLevels:\n' + help.levels]),
        '\nExit codes:\n' + help.exitCodes,
        '\nExample:\n' + help.examples,
    ].join('\n');
}
