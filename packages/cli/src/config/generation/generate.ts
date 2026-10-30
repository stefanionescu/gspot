import { GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';

export const AUTO_LF_ATTRIBUTES = ['text=auto', 'eol=lf'] as const;

export const ATTRIBUTE_QUOTED_CHARACTERS = /[\s"]/u;

export const ATTRIBUTE_GLOB_CHARACTERS = /[\\*?[]/gu;

export const LF_ATTRIBUTES = 'text eol=lf';

export const GIT_ATTRIBUTES_BLOCK = `${GSPOT_FOLDER}/** linguist-generated
${GSPOT_FOLDER}/** ${LF_ATTRIBUTES}
.gitignore ${LF_ATTRIBUTES}
.gitattributes ${LF_ATTRIBUTES}`;

export const TOOL_FOLDER_IGNORES = ['node_modules/', '.venv/', 'vale/'] as const;
