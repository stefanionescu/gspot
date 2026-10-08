import { DOT_GSPOT } from '#cli/config/platform/locations.ts';

// Every file gspot writes keeps LF, so a CRLF checkout does not mark generated files and hooks as changed.
export const GIT_ATTRIBUTES_BLOCK = `${DOT_GSPOT}/** linguist-generated
${DOT_GSPOT}/** text eol=lf
.gitignore text eol=lf
.gitattributes text eol=lf`;
