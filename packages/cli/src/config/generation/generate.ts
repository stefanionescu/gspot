import { DOT_GSPOT } from '#cli/config/gspot-paths.ts';

export const CONFIG_FILE_TOML_FORMAT = { inlineTableStart: Number.MAX_SAFE_INTEGER, bracketSpacing: false } as const;

export const JSON_INDENT = 4;

export const AUTO_LF_ATTRIBUTES = ['text=auto', 'eol=lf'] as const;

export const ATTRIBUTE_QUOTED_CHARACTERS = /[\s"]/u;

export const ATTRIBUTE_GLOB_CHARACTERS = /[\\*?[]/gu;

export const LF_ATTRIBUTES = 'text eol=lf';

// Every file gspot writes keeps LF, so a CRLF checkout does not mark generated files and hooks as changed.
export const GIT_ATTRIBUTES_BLOCK = `${DOT_GSPOT}/** linguist-generated
${DOT_GSPOT}/** ${LF_ATTRIBUTES}
.gitignore ${LF_ATTRIBUTES}
.gitattributes ${LF_ATTRIBUTES}`;
