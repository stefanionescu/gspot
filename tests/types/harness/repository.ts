import type { Level } from '#cli/types/configurations.ts';
import type { Correction, FindingCase, CheckCommand } from '#tests/types/harness/check-case.ts';

/** What a sandbox holds and selects. */
type RepositorySetup = {
    /** The configurations init selects by name. */
    configurations: string[];
    /** The packages the test manifest depends on; no manifest is written without them. */
    dependencies?: Record<string, string>;
    /** The source files of the repository. */
    files: Record<string, string>;
    /** Static TypeScript project data serialized when the sandbox is prepared. */
    tsconfig?: Record<string, unknown>;
    /** The level set after init; all unless a test says otherwise. */
    level?: Level;
    before?: (root: string) => void | Promise<void>;
    prepare?: (root: string, environment: Record<string, string>) => void | Promise<void>;
    corrected?: (entry: FindingCase) => Correction;
};

/** A prepared sandbox and its command environment. */
export type TestRepository = { root: string; environment: Record<string, string>; run: CheckCommand };

/** CLI scenarios have no installation or module-linking inputs. */
export type InProcessScenario = RepositorySetup & {
    installs?: never;
    modules?: never;
    without?: never;
    init?: never;
};

/** Native tool scenarios initialize their configurations and installed tool projects. */
export type InstalledScenario = RepositorySetup & {
    without?: string[];
    init?: string[];
    tools?: string[];
};

/** Preparation belongs to the suite that owns the scenario. */
export type RepositoryScenario = InProcessScenario | InstalledScenario;

/** One installed repository shared by the cases of a table. */
export type OwnedTestRepository = TestRepository & AsyncDisposable;

/** Each declared runtime has six independent forms of project evidence. */
export type RuntimeEvidenceCase = {
    name: string;
    runtime: string;
    package: {
        engines?: Record<string, string>;
        scripts?: Record<string, string>;
        devDependencies?: Record<string, string>;
    };
    source: string;
    detected: boolean;
    toolProjectManifest?: { engines: Record<string, string> };
};
