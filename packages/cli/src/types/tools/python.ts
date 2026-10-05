import type { Snapshot } from '#cli/types/platform/root.ts';
import type { Session } from '#cli/types/execution/session.ts';

/** Immutable Python project and lock inputs for preparing an installation. */
export type PythonToolInputs = { project: Snapshot; lock: Snapshot };

/** Repository identity and the command-owned Python installer used during preparation. */
export type PythonPreparation = Pick<Session, 'root' | 'pythonInstaller'>;
/** The Python acquisition, lock, and environment commands calculated without running them. */
export type PythonInstallationPlan = { installer: string[][]; lock: string[][]; environment: string[][] };
