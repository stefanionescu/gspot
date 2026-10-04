import {
    DOT_GSPOT,
    STATE_DIRECTORY,
    NODE_MODULES_DIRECTORY,
    PYTHON_ENVIRONMENT_DIRECTORY,
} from '#cli/config/platform/locations.ts';

/** Private tool projects and successful-run state never enter the repository's tracked files. */
export const PRIVATE_PATHS = [`${NODE_MODULES_DIRECTORY}/`, `${PYTHON_ENVIRONMENT_DIRECTORY}/`, `${STATE_DIRECTORY}/`];

// Every file gspot writes keeps LF, so a CRLF checkout does not mark generated files and hooks as changed.
export const GIT_ATTRIBUTES_BLOCK = `${DOT_GSPOT}/** linguist-generated
${DOT_GSPOT}/** text eol=lf
.gitignore text eol=lf
.gitattributes text eol=lf`;
