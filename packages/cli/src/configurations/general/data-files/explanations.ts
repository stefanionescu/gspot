import { YAML_MESSAGES, YAML_RULES } from '#cli/config/configurations/general.ts';
import type { RuleExplanations } from '#cli/types/tools.ts';

export const YAML_EXPLANATIONS = {
    [YAML_RULES.syntax]: {
        description: 'YAML must parse without syntax errors.',
        why: 'A consumer cannot read malformed YAML.',
        fix: 'Fix the syntax at the reported line.',
        example: '`items: [` needs a closing bracket, such as `items: []`.',
    },
    [YAML_RULES.duplicate]: {
        description: 'Each mapping key appears once.',
        why: 'Consumers can reject duplicate keys or silently discard one value.',
        fix: 'Keep one definition of the key and remove the other.',
        example: 'Replace two `enabled:` entries in the same mapping with one.',
    },
    [YAML_RULES.anchors]: {
        description: 'Aliases name preceding anchors in the same document, and every anchor has a use.',
        why: 'An undefined alias has no value, and an unused anchor adds misleading structure.',
        fix: 'Declare the anchor before its alias, or remove the unused anchor.',
        example: '`timeout: &request-timeout 30` followed by `retry_timeout: *request-timeout` shares one value.',
    },
    [YAML_RULES.truthy]: {
        description: 'Boolean-looking strings are quoted, and booleans use lowercase true or false.',
        why: 'YAML versions disagree about whether yes, no, on, and off are strings or booleans.',
        fix: YAML_MESSAGES.truthy,
        example: 'Write `answer: "yes"` for a string or `enabled: true` for a boolean.',
    },
    [YAML_RULES.octal]: {
        description: 'Plain numbers have no leading zero or octal prefix.',
        why: 'YAML versions can read the same leading-zero value as different numbers.',
        fix: YAML_MESSAGES.octal,
        example: 'Write `mode: "0755"` when the exact digits matter.',
    },
    [YAML_RULES.documents]: {
        description: 'A file contains one YAML document.',
        why: 'A consumer that reads one document can miss the rest of a stream.',
        fix: YAML_MESSAGES.documents,
        example: 'Split documents separated by `---` into separate files unless the consumer requires a stream.',
    },
    [YAML_RULES.merge]: {
        description: 'Mappings have explicit keys instead of the << merge key.',
        why: 'YAML 1.2 does not define merge keys, and consumers can ignore them.',
        fix: YAML_MESSAGES.merge,
        example: 'Replace `<<: *defaults` with the mapping keys the consumer needs.',
    },
    [YAML_RULES.anchorNames]: {
        description: 'An anchor name describes the value it holds.',
        why: 'Generated names hide the relationship between the anchor and its aliases.',
        fix: 'Rename the anchor and its aliases for their shared value.',
        example: 'Replace `&a1` and `*a1` with `&request-timeout` and `*request-timeout`.',
    },
    [YAML_RULES.version]: {
        description: 'A decimal-looking string with a trailing zero is quoted.',
        why: 'A numeric parser discards the trailing zero of a value such as 1.10.',
        fix: YAML_MESSAGES.version,
        example: 'Write `version: "1.10"` to keep the complete version string.',
    },
    [YAML_RULES.comments]: {
        description: 'Comments sit above the key, except version comments after pinned actions.',
        why: 'A comment above a key stays separate from its value.',
        fix: YAML_MESSAGES.comments,
        example: 'Move `enabled: true # required` to a comment line above `enabled: true`.',
    },
    [YAML_RULES.extension]: {
        description: 'YAML files use .yml unless a consumer names the .yaml file.',
        why: 'One extension keeps file discovery predictable while preserving required tool names.',
        fix: YAML_MESSAGES.extension,
        example: 'Rename `settings.yaml` to `settings.yml`; keep `pnpm-workspace.yaml`.',
    },
} as const satisfies RuleExplanations;
