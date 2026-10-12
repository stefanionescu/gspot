import { findingAt } from '#cli/checks/finding.ts';
import { ENV_ROLE } from '#cli/config/settings/values.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import { readScripts } from '#cli/checks/language/bash/scripts.ts';
import { DEFAULT_EXPANSION } from '#cli/config/checks/language/bash.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';

/**
 * One finding per `${name:-value}` default outside the environment owners.
 * @param input the check context.
 * @returns the findings.
 */
export async function bashVariableDefaults(input: CheckInput): Promise<Finding[]> {
    const isOwner = pathMatcher(input.settingsFile.settings.architecture.roles[ENV_ROLE]);
    const index = await readScripts(input);
    return index.flatMap((file) => {
        if (isOwner(file.path)) return [];
        return file.code.flatMap((line, position) => {
            const match = DEFAULT_EXPANSION.exec(line);
            return match === null
                ? []
                : [
                      findingAt(
                          input,
                          { file: file.path, line: position + 1 },
                          'default-outside-owner',
                          `${match[0]} sets a default outside the configuration owners.`,
                      ),
                  ];
        });
    });
}
