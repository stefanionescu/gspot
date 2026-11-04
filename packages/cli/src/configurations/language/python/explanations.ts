import type { LintRuleDocs } from '#cli/types/tools.ts';
import { PYTHON_RULES, PIP_INSTALL_MESSAGE } from '#cli/config/configurations/python.ts';

export const PIP_INSTALL_RULE_DOCS = {
    [PYTHON_RULES.requirementsFile]: {
        description: 'The scope keeps no requirements file by hand beside its lockfile.',
        why: 'A second list of dependencies drifts from `pyproject.toml` and the lockfile.',
        fix: 'Generate the file from the lockfile and mark it generated in `.gitattributes`, or delete it.',
        example: 'A hand-written `requirements.txt` beside `uv.lock` reports `requirements-file`.',
    },
    [PYTHON_RULES.pipInstall]: {
        description: 'No shell script, YAML or TOML file, or Dockerfile installs a package with `pip install`.',
        why: 'A package that `pip install` adds is missing from `pyproject.toml` and the lockfile.',
        fix: PIP_INSTALL_MESSAGE,
        example: '`pip install requests` in `scripts/setup.sh` reports `pip-install`.',
    },
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const VULTURE_RULE_DOCS = {
    [PYTHON_RULES.unreachableCode]: {
        description: 'No code follows a `return`, `raise`, `break`, or `continue` in the same block.',
        why: 'Code that never runs misleads the reader about what the function does.',
        fix: 'Remove the lines after that statement, or move them before it.',
        example: 'A line after `return result` in the same block reports `unreachable-code`.',
    },
    'unused-attribute': {
        description: 'Code reads each attribute that it sets.',
        why: 'An attribute that nothing reads is dead code that a reader still has to understand.',
        fix: 'Delete the attribute. When code reads it by name, ignore the finding with a reason.',
        example: '`self.retries = 3`, which nothing reads, reports `unused-attribute`.',
    },
    'unused-class': {
        description: 'Code uses each class that it defines.',
        why: 'A class that nothing uses is dead code that a reader still has to understand.',
        fix: 'Delete the class. When code loads it by name, ignore the finding with a reason.',
        example: 'A `LegacyExporter` class that no module imports reports `unused-class`.',
    },
    'unused-function': {
        description: 'Code calls each function that it defines.',
        why: 'A function that nothing calls is dead code that a reader still has to understand.',
        fix: 'Delete the function. When code calls it by name, ignore the finding with a reason.',
        example: 'A `format_legacy_date()` that no module calls reports `unused-function`.',
    },
    'unused-method': {
        description: 'Code calls each method that a class defines.',
        why: 'A method that nothing calls is dead code that a reader still has to understand.',
        fix: 'Delete the method. When code calls it by name, ignore the finding with a reason.',
        example: 'A `Report.to_xml()` that nothing calls reports `unused-method`.',
    },
    'unused-property': {
        description: 'Code reads each property that a class defines.',
        why: 'A property that nothing reads is dead code that a reader still has to understand.',
        fix: 'Delete the property. When code reads it by name, ignore the finding with a reason.',
        example: 'A `@property def legacy_id(self)` that nothing reads reports `unused-property`.',
    },
} as const satisfies Readonly<Record<string, LintRuleDocs>>;
