import { DOT_GSPOT } from '#cli/config/system/locations.ts';

export const LF_ATTRIBUTES = 'text eol=lf';

// Every file gspot writes keeps LF, so a CRLF checkout does not mark generated files and hooks as changed.
export const GIT_ATTRIBUTES_BLOCK = `${DOT_GSPOT}/** linguist-generated
${DOT_GSPOT}/** ${LF_ATTRIBUTES}
.gitignore ${LF_ATTRIBUTES}
.gitattributes ${LF_ATTRIBUTES}`;

export const ATTRIBUTE_GLOB_CHARACTERS = /[\\*?[]/gu;
export const ATTRIBUTE_QUOTED_CHARACTERS = /[\s"]/u;
export const AUTO_LF_ATTRIBUTES = ['text=auto', 'eol=lf'] as const;
export const TOOL_FILE_REFERENCE = /(?:['"]\.\/|\bnew\s+URL\(\s*['"])(?<path>[^'"]+)['"]/gu;

/** The file name of the Semgrep rule pack of a configuration. */
export const SEMGREP_RULE_PACK_FILE = 'semgrep.yml';

/** The folder of a configuration that holds the tool files of scopes with their own text. */
export const TOOL_FILE_SCOPES_FOLDER = 'scopes';

export const JSON_INDENT = 4;
