import type { Level } from '#cli/types/configurations.ts';
import type { Correction, FindingCase, CheckCommand } from '#tests/types/harness/check-case.ts';

/** What a test repository holds and selects. */
export type RepositorySetup = {
    /** The configurations init selects by name. */
    configurations: string[];
    /** The packages the test manifest depends on; no manifest is written without them. */
    dependencies?: Record<string, string>;
    /** The source files of the repository. */
    files: Record<string, string>;
    /** Static TypeScript project data serialized when the fixture is prepared. */
    tsconfig?: Record<string, unknown>;
    /** Manual language and framework removals applied after initialization. */
    without?: string[];
    /** The init flags after the configurations; no runner, hooks, CI, agent rules, or install unless a sandbox says otherwise. */
    init?: string[];
    /** Tools on the PATH beside typos, ec, and ast-grep. */
    tools?: string[];
    /** Whether this repository's node_modules is linked into the sandbox; it is unless a fixture says otherwise. */
    modules?: boolean;
    /** The level set after init; all unless a test says otherwise. */
    level?: Level;
    /** Whether init installs the private tools; a table of checks gspot runs itself needs none and runs in-process. */
    installs?: boolean;
};

/** A test repository after its install: the root and the environment every command of the test runs with. */
export type TestRepository = { root: string; environment: Record<string, string> };

/** A test table's repository, setup, and default correction. */
export type RepositoryScenario = RepositorySetup & {
    dirname?: string;
    before?: (root: string) => void;
    prepare?: (root: string, environment: Record<string, string>) => void | Promise<void>;
    corrected?: (entry: FindingCase) => Correction;
};

/** One installed repository shared by the cases of a table. */
export type OwnedTestRepository = TestRepository & AsyncDisposable & { run: CheckCommand };
