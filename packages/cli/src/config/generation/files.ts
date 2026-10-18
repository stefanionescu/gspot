import { DOT_GSPOT, TOOL_FILES_FOLDER } from '#cli/config/system/locations.ts';

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

export const SEMGREP_RULE_PACK_FOLDER = `${TOOL_FILES_FOLDER}/semgrep/`;

export const JSON_INDENT = 4;
