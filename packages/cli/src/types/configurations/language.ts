import type { z } from 'zod';
import type { CST } from 'yaml';
import type { Node } from 'web-tree-sitter';
import type { Files } from '#cli/types/system.ts';
import type { CheckFinding } from '#cli/types/engine/run.ts';
import type { FENCE_GRAMMARS } from '#cli/config/parsers/code.ts';
import type { ScriptSyntax, ParsedTsconfig } from '#cli/types/parsers.ts';
import type { DOCSTRING_STYLES } from '#cli/config/configurations/shared.ts';
import type { xccovSchema, deptrySchema } from '#cli/schemas/configurations.ts';

export type LayoutFinding = { line: number; rule: string; message: string };

export type ScriptFile = ScriptSyntax & {
    path: string;
    lines: string[];
    executable: boolean;
};

export type MarkupAttribute = { name: string; value: string; element: string; node: Node };

export type FormatFenceParser = 'json' | 'jsonc' | 'toml' | 'yaml';

export type GrammarFenceParser = (typeof FENCE_GRAMMARS)[number];

export type FenceParser = FormatFenceParser | GrammarFenceParser;

export type FenceSyntaxError = { line: number; message: string };

export type DeptryProject = z.infer<typeof deptrySchema>;

export type PydoclintOptions = { command: string[]; style: PythonDocstringStyle | undefined };

export type PythonDocstringStyle = (typeof DOCSTRING_STYLES)[number];

type SwiftBuildPaths = {
    folder: string;
    log: string;
    store: string;
    commandArguments: string[];
    testArguments: string[];
};

export type SwiftBuildPlan = SwiftBuildPaths & ({ kind: 'package'; scratch: string } | { kind: 'xcode' });

export type SwiftBuildOutput = { code: number; output: string; source: string; files: Files };

export type SwiftBuildSetup = { files: Files; source: string };

export type CoverageOutput = z.infer<typeof xccovSchema>;

export type CoverageRun = CoverageOutput & { failures: CheckFinding[] };

export type BashCommandForm = {
    rule: string;
    message: string;
    present?: readonly RegExp[];
    absent?: RegExp;
    allLevel?: true;
};

export type StylelintComponent = {
    files: readonly string[];
    customSyntax: string;
    ignorePseudoClasses: readonly string[];
    functions?: readonly string[];
};

export type MarkdownlintFormatterInput = { results: unknown; logMessage: (message: string) => void };

export type TsconfigProject = { path: string; parsed: ParsedTsconfig };

export type YamlFinding = { offset: number; rule: string; message: string };

export type YamlAnchorToken = Pick<CST.SourceToken, 'offset' | 'source'>;
