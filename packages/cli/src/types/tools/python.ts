import type { z } from 'zod';
import type { lockfileSchema } from '#cli/parsers/schema/python/tools.ts';

/** Repository identity and the command-owned Python installer used during preparation. */
export type PythonPreparation = {
    root: string;
    cancelSignal?: AbortSignal | undefined;
    /** One lazily acquired installer shared by this command's Python operations. */
    pythonInstaller: (cancelSignal?: AbortSignal) => Promise<string>;
};
/** The repository and acquired uv executable used by the native installation. */
export type PythonExecution = { root: string; executable: string; cancelSignal?: AbortSignal | undefined };

/** The validated uv lockfile of the Python tool project. */
export type PythonToolLockfile = z.infer<typeof lockfileSchema>;

/** A dependency requirement recorded by uv for constraints and root metadata. */
export type PythonRequirement = NonNullable<NonNullable<PythonToolLockfile['manifest']>['constraints']>[number];

/** Authored uv configuration sources, with uv.toml taking precedence over pyproject.toml. */
export type PythonSettingsSources = { uv: string | undefined; project: string | undefined };

/** Repository index settings and the credentials that generated output must omit. */
export type PythonIndexSettings = { settings: Record<string, unknown>; credentials: string[] };
