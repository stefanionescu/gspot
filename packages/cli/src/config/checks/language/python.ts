// The literal values checks/language/python reads: names, patterns, limits, and tables.

export const PYTHON_MANIFEST = 'pyproject.toml';
export const BROKEN_CONTRACT = /^(?<name>.+?) BROKEN$/u;
export const REQUIREMENTS_FILE = /(?:^|\/)requirements[^/]*\.txt$/u;
export const PIP_INSTALL = /\bpip3? install\b/u;
export const INSTALL_HOLDERS = ['.sh', '.bash', '.yml', '.yaml', '.toml', 'Dockerfile'];
export const DEFAULT_FILE_LINES = 300;
export const DEFAULT_FUNCTION_LINES = 60;
export const DEFAULT_PACKAGE_EXPORTS = 20;
export const SINGLETONS_ALLOWED = new Set(['app', 'router', 'logger', 'log', 'settings']);
export const CLASS_CALL = /^[A-Z][A-Za-z\d]*\(/u;
export const DEFINITIONS = new Set(['function_definition', 'class_definition']);
export const IMPORTS = new Set(['import_statement', 'import_from_statement', 'future_import_statement']);

/** A comment that directs a tool rather than a reader, which must sit on the line it covers. */
export const DIRECTIVE = /^#\s*(?:noqa|type:|pyright:|ruff:|isort:|pylint:|mypy:|fmt:|nosec|pragma)/u;
export const PACKAGE_FILE = '__init__.py';
export const PLACEHOLDERS = new Set(['todo', 'docstring', 'tbd', 'fixme', 'description', 'summary']);

export const DOCSTRING_COMMAND = ['pydoclint', '--allow-init-docstring', 'true', '--quiet', '{files}'];
