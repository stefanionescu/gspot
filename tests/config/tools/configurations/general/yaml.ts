/** Scoped truthy policies must reach their matching native YAML configuration. */
export const YAML_SCOPE_TABLES =
    '[format]\nindent_width = 4\n[[format.overrides]]\npaths = ["**/*.yaml"]\nindent_width = 2\n[tools.yamllint.rules]\ntruthy = { allowed-values = ["yes"] }\ndocument-start = { present = true }\nkey-ordering = {}\nconstructor = { create = "literal-only option" }\n[agent_rules]\nenabled = false\n[scope."app"]\nconfigurations = []\n[scope."app".tools.yamllint.rules]\ntruthy = { allowed-values = ["no"] }\n';

/** Two-space formatting and consumer-owned on keys stay valid in each project. */
export const YAML_SCOPE_FILES = {
    'settings/project.yaml': 'parent:\n  enabled: yes\non:\n  enabled: yes\n',
    'app/settings/project.yaml': 'parent:\n  enabled: no\non:\n  enabled: no\n',
};

/** A child value accepted only by the root reveals leaked native options. */
export const YAML_SCOPE_SAMPLE = 'parent:\n  enabled: yes\non:\n  enabled: no\n';
