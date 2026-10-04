export const WAITING_SETTING =
    '[[setting]]\nname = "tools.waiting.target"\ntype = "string"\ndirection = "neutral"\ndefault = ""\nsummary = "Where the tool looks."\n';

/** Two owners may vary this default while retaining the same public setting meaning. */
export const SHARED_SETTING = `[[setting]]
name = "example.target"
type = "string"
direction = "neutral"
default = "initial"
summary = "Where the example tool writes its output."
`;
