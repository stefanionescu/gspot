import type { RuleExplanations } from '#cli/types/tools.ts';
import { SYNTAX_EXPLANATIONS } from '#cli/configurations/syntax.ts';
import { DEPENDENCY_RULES } from '#cli/config/configurations/dependencies.ts';

export const LOCKFILE_EXPLANATIONS = {
    [DEPENDENCY_RULES.host]: {
        description: 'Each download URL of a JavaScript lockfile uses HTTPS and a host of `allowed_registries`.',
        why: 'A package from another host, or over plain HTTP, can differ from the package the team reviewed.',
        fix: 'Install the package from an allowed registry, or add its host to `dependencies.allowed_registries`.',
        example: 'A `resolved` URL that starts with `http://` reports `host`.',
    },
    [DEPENDENCY_RULES.foreignLockfile]: {
        description: 'A scope holds the lockfile of one JavaScript package manager.',
        why: 'Each package manager reads only its own lockfile, so two lockfiles record two dependency trees.',
        fix: 'Keep the lockfile of the package manager that the scope uses, and delete the others.',
        example: '`package-lock.json` beside `pnpm-lock.yaml` reports `foreign-lockfile`.',
    },
} as const satisfies RuleExplanations;

export const PACKAGE_MANAGER_PIN_EXPLANATIONS = {
    [DEPENDENCY_RULES.packageManagerPin]: {
        description: '`packageManager` in `package.json` names the version of the package manager that mise pins.',
        why: 'CI installs the version that `packageManager` names, so another local version can write another lockfile.',
        fix: 'Change `packageManager` or the mise pin, so that both name one version.',
        example: '`"packageManager": "pnpm@9.1.0"` beside a mise pin of pnpm 9.4.0 reports `package-manager-pin`.',
    },
    ...SYNTAX_EXPLANATIONS,
} as const satisfies RuleExplanations;
