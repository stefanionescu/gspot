import type { Session } from '#cli/types/planning.ts';
import type { ToolSearch } from '#cli/types/tools/install.ts';
import type { PythonPreparation } from '#cli/types/tools/python.ts';

/** A command's core session with executable discovery and tool-project preparation. */
export type ToolSession = Session & ToolSearch & PythonPreparation;
