import ts from 'typescript';
import { DOT_GSPOT } from '#cli/config/gspot-folder.ts';
import { NODE_MODULES } from '#cli/config/files/names.ts';
import { GIT_FOLDER } from '#cli/config/repository/files/tracked.ts';

/** The compiler options that turn a shipped TypeScript source into the JavaScript module that gspot writes. */
export const TRANSPILE_OPTIONS = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } as const;

/** The file name of the Semgrep rule pack of a configuration. */
export const SEMGREP_RULE_PACK_FILE = 'semgrep.yml';

export const CONFIG_FILE_REFERENCE = /(?:['"]\.\/|\bnew\s+URL\(\s*['"])(?<path>[^'"]+)['"]/gu;

/** Preview Ansible rules stay disabled at both levels. */
export const ANSIBLE_LINT_ALWAYS_OFF = ['experimental'] as const;

export const TRIVY_SKIPPED_FOLDERS = [NODE_MODULES, DOT_GSPOT, GIT_FOLDER] as const;

/** An ES import statement. jscpd skips import lists, because they hold no copied logic. */
export const JSCPD_IMPORT_PATTERNS = [String.raw`import\s[^;]*?from\s*['"][^'"]+['"]\s*;`] as const;

export const JSCPD_IGNORED = ['**/*.md', '**/*.mdx'] as const;

export const CONFIG_FILE_TOML_FORMAT = { inlineTableStart: Number.MAX_SAFE_INTEGER, bracketSpacing: false } as const;
