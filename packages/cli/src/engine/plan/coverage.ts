import { getTable } from '#cli/settings/tables.ts';
import type { Scope } from '#cli/types/settings.ts';
import type { Check } from '#cli/types/manifests.ts';
import { COVERAGE_DIMENSIONS } from '#cli/config/engine.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';

export function selectCheckCommand(
    planned: Pick<PlannedCheck, 'check' | 'scope' | 'configuration'>,
    authored: Pick<Check, 'command'>,
): string[] | undefined {
    if (authored.command !== undefined) return authored.command;
    const { command } = planned.check;
    const coverageArguments = planned.check.coverage_arguments;
    if (
        command === undefined ||
        planned.configuration === undefined ||
        !hasCoverageArguments(command, coverageArguments) ||
        COVERAGE_DIMENSIONS.some(
            (name) =>
                command.some((word) => word.includes(`{setting:coverage.${name}}`)) &&
                getTable(planned.scope.settings, 'coverage')[name] > 0,
        )
    )
        return command;
    return command.filter((argument) => !hasCoverageArguments([argument], coverageArguments));
}

export function isCoverageOff(scope: Scope): boolean {
    const coverage = getTable(scope.settings, 'coverage');
    return COVERAGE_DIMENSIONS.every((name) => coverage[name] === 0);
}

export function hasCoverageArguments(
    command: readonly string[] | undefined,
    coverageArguments: readonly string[] | undefined,
): boolean {
    return (
        command?.some(
            (word) =>
                coverageArguments?.some((argument) => word === argument || word.startsWith(`${argument}=`)) === true,
        ) === true
    );
}
