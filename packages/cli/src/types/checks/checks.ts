// The types of checks in this package.
import type { ScriptIndex } from '#cli/types/checks/language/bash.ts';
import type { TrackedFile } from '#cli/types/repository/repository.ts';
import type { Finding, EngineInput } from '#cli/types/execution/execution.ts';

/** One analysis: a function over the context that returns findings. */
export type StructureAnalysis = (
    context: StructureInput,
    scripts: () => Promise<ScriptIndex>,
) => Finding[] | Promise<Finding[]>;

/** What every analysis receives. */
export type StructureInput = {
    input: EngineInput;
    /** The files this check runs over. */
    files: TrackedFile[];
    /** A limit by its `[limits]` key, read for the file's language. */
    limit: (key: string, language?: string) => number | undefined;
    /** A `[tools.bash]` text slot, or the fallback. */
    bashText: (slot: string, otherwise: string) => string;
    /** A `[tools.bash]` list slot, empty when unset. */
    bashList: (slot: string) => string[];
    /** A `[tools.bash]` slot as written. */
    bashSetting: (slot: string) => unknown;
};
