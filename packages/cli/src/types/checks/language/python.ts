import type { RawPolicy } from '#cli/types/policy/settings.ts';
import type { PythonDocstringStyle } from '#cli/types/parsers/python.ts';

/** Native docstring arguments and the authored or inherited style, before source detection. */
export type DocstringConfiguration = { command: string[]; style: PythonDocstringStyle | undefined };

/** Validated names and optional repository paths accepted by the Python singleton check. */
export type SingletonAllowance = NonNullable<
    NonNullable<RawPolicy['structure']>['python']['singletons_allowed']
>[number];
