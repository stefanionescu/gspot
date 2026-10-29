export const IGNORE_COMMENT_CASES = [
    {
        name: 'first ignore',
        source: '# Root owner\nlevel="all"\n',
        target: 'level="all"\n[[ignore]]\ncheck="docs/links"\npaths=["docs/**"]\nreason="Private documentation"\nuntil=2026-12-31\n',
        expected:
            '# Root owner\nlevel="all"\n\n[[ignore]]\ncheck = "docs/links"\npaths = ["docs/**"]\nreason = "Private documentation"\nuntil = 2026-12-31\n\n',
    },
    {
        name: 'merged ignores date array comments',
        source: 'spelling.allowed_words={BannedWord="The project uses this reviewed name."}\n\n# First ignore\n[[ignore]] # First header inline\ncheck="z/check"\npaths=[\n # A path\n "a.ts", # A inline\n]\nreason="Reviewed findings stay ignored intentionally."\n\n# Second ignore\n[[ignore]] # Second header inline\ncheck="z/check"\npaths=[\n # B path\n "b.ts"\n]\nreason="Reviewed findings stay ignored intentionally."\n',
        target: 'spelling.allowed_words={BannedWord="The project uses this reviewed name."}\n\n[[ignore]]\ncheck = "z/check"\npaths = [ "a.ts" ]\nreason="Reviewed findings stay ignored intentionally."\nuntil = 2026-12-31\n\n[[ignore]]\ncheck = "z/check"\npaths = [ "b.ts" ]\nreason="Reviewed findings stay ignored intentionally."\nuntil = 2026-12-31\n',
        expected:
            'spelling.allowed_words={BannedWord="The project uses this reviewed name."}\n\n# First ignore\n[[ignore]] # First header inline\ncheck="z/check"\npaths=[\n # A path\n "a.ts", # A inline\n]\nreason="Reviewed findings stay ignored intentionally."\n\nuntil = 2026-12-31\n# Second ignore\n[[ignore]] # Second header inline\ncheck="z/check"\npaths=[\n # B path\n "b.ts"\n]\nreason="Reviewed findings stay ignored intentionally."\nuntil = 2026-12-31\n',
    },
    {
        name: 'split ignore row',
        source: '# Original physical row\n[[ignore]]\ncheck="a/check"\npaths=[\n # Split A\n "a.ts", # Split A inline\n # Split B\n "b.ts" # Split B inline\n]\nreason="Reviewed findings stay ignored intentionally." # Authored reason\n',
        target: '[[ignore]]\ncheck = "a/check"\npaths = [ "a.ts" ]\nreason="Reviewed findings stay ignored intentionally."\nuntil = 2026-10-10\n\n[[ignore]]\ncheck = "a/check"\npaths = [ "b.ts" ]\nreason="Reviewed findings stay ignored intentionally."\nuntil = 2026-12-31\n',
        expected:
            '# Original physical row\n[[ignore]]\ncheck="a/check"\npaths=[\n # Split A\n "a.ts"  # Split A inline\n]\nreason="Reviewed findings stay ignored intentionally." # Authored reason\nuntil = 2026-10-10\n\n[[ignore]]\ncheck = "a/check"\npaths = ["b.ts"]\nreason = "Reviewed findings stay ignored intentionally."\nuntil = 2026-12-31\n',
    },
    {
        name: 'same date rows',
        source: '# A row\n[[ignore]]\ncheck="a/check"\npaths=["a.ts"]\nreason="Reviewed findings stay ignored intentionally."\nuntil=2026-10-01\n\n# B row\n[[ignore]]\ncheck="a/check"\npaths=["b.ts"]\nreason="Reviewed findings stay ignored intentionally."\nuntil=2026-11-01\n',
        expected:
            '# A row\n[[ignore]]\ncheck="a/check"\npaths=["a.ts"]\nreason="Reviewed findings stay ignored intentionally."\nuntil=2026-10-01\n\n# B row\n[[ignore]]\ncheck="a/check"\npaths=["b.ts"]\nreason="Reviewed findings stay ignored intentionally."\nuntil=2026-11-01\n',
    },
];
