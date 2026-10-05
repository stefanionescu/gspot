import type { Snapshot } from '#cli/types/platform/root.ts';

/** Immutable Python project and lock inputs for preparing an installation. */
export type PythonToolInputs = { project: Snapshot; lock: Snapshot };

/** Repository identity and the command-owned Python installer used during preparation. */
export type PythonPreparation = {
    root: string;
    /** One lazily acquired installer shared by this command's Python operations. */
    pythonInstaller: () => Promise<string>;
};
/** The Python acquisition, lock, and environment commands calculated without running them. */
export type PythonInstallationPlan = { installer: string[][]; lock: string[][]; environment: string[][] };
