// Variable defaults live in the configuration owners. Searched: shellcheck; it accepts every expansion.
import type { Analysis } from '#cli/structure/engine.ts';
import { DEFAULT_EXPANSION } from '#cli/structure/patterns.ts';

/**
 * One finding per `${name:-value}` default outside the configuration owners, unless an allowed fragment is on the line.
 * @param context the check context
 * @param scripts the shell index
 * @returns the findings
 */
export const scriptConfigDefaults: Analysis = async (context, scripts) => {
    const owners = new Set(context.bashSetting('config_owners') as string[] | undefined);
    const fragments = context.bashList('default_fragments_allowed');
    const index = await scripts();
    return index.files.flatMap((file) => {
        if (owners.has(file.path)) return [];
        return file.lines.flatMap((line, position) => {
            if (line.trimStart().startsWith('#') || fragments.some((fragment) => line.includes(fragment))) return [];
            const match = DEFAULT_EXPANSION.exec(line);
            return match === null
                ? []
                : [
                      context.report(
                          file.path,
                          position + 1,
                          'default-outside-owner',
                          `${match[0]} sets a default outside the configuration owners.`,
                      ),
                  ];
        });
    });
};
