import type { z } from 'zod';
import type { FileCopy } from '#cli/types/platform/root.ts';
import type { lockfileSchema } from '#cli/parsers/schema/python/tools.ts';

/** Immutable Python project and lockfile inputs for preparing an installation. */
export type PythonToolInputs = { project: FileCopy; lockfile: FileCopy };

/** Repository identity and the command-owned Python installer used during preparation. */
export type PythonPreparation = {
    root: string;
    /** One lazily acquired installer shared by this command's Python operations. */
    pythonInstaller: () => Promise<string>;
};
/** The Python acquisition, lockfile, and environment commands calculated without running them. */
export type PythonInstallationPlan = { installer: string[][]; lockfile: string[][]; environment: string[][] };

/** The validated uv lockfile of the Python tool project. */
export type PythonToolLockfile = z.infer<typeof lockfileSchema>;

/** A dependency requirement recorded by uv for constraints and root metadata. */
export type PythonRequirement = NonNullable<NonNullable<PythonToolLockfile['manifest']>['constraints']>[number];

/** Authored uv configuration sources, with uv.toml taking precedence over pyproject.toml. */
export type PythonSettingsSources = { uv: string | undefined; project: string | undefined };

/** Repository index settings and the credentials that generated output must omit. */
export type PythonIndexSettings = { settings: Record<string, unknown>; credentials: string[] };
