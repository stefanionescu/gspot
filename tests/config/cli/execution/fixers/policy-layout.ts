/** Native policy corrections retain semantic comments and unquoted calendar dates. */
export const POLICY_LAYOUT_CASES = [
    {
        name: 'header comments and omitted defaults',
        source: '# Copied from template https://example.com/team.toml\nlevel="recommended"\nconfigurations=[]\n# Hook comment\n[hooks]\nenabled=true\n',
        expected:
            '# Copied from template https://example.com/team.toml\n\nconfigurations = []\n\n# Hook comment\n[hooks]\nenabled = true\n',
    },
    {
        name: 'native expiry and compact paths',
        source: 'configurations=[]\nignore=[{check="gspot/drift",reason="Another generator owns reviewed outputs.",paths=["other/**"],until=2027-10-07}]\n',
        expected:
            'configurations = []\n\n[[ignore]]\ncheck = "gspot/drift"\npaths = ["other/**"]\nreason = "Another generator owns reviewed outputs."\nuntil = 2027-10-07\n',
    },
    {
        name: 'non-contiguous native option tables',
        source: 'configurations=[]\n# Formatter options\n[tools.prettier.verbatim]\nsingleQuote=false\n[hooks]\nenabled=true\n# Shell sources\n[tools.shellcheck.verbatim]\nsource-path="SCRIPTDIR"\n[reasons]\n"tools.prettier.verbatim"="The project uses native formatter options."\n"tools.shellcheck.verbatim"="The project uses native source paths."\n',
        expected:
            'configurations = []\n\n[hooks]\nenabled = true\n\n# Formatter options\n[tools.prettier.verbatim]\nsingleQuote = false\n\n# Shell sources\n[tools.shellcheck.verbatim]\nsource-path = "SCRIPTDIR"\n\n[reasons]\n"tools.prettier.verbatim" = "The project uses native formatter options."\n"tools.shellcheck.verbatim" = "The project uses native source paths."\n',
    },
];

export const POLICY_LAYOUT_EXTERNAL_EDIT = 'configurations=[]\n# External edit must survive.\n[hooks]\nenabled=true\n';

export const POLICY_LAYOUT_UNREPRESENTABLE =
    'configurations=[]\n[tools.prettier.verbatim]\nmixed=[{first=1, # This field owns the comment.\nsecond=2},3]\n[reasons]\n"tools.prettier.verbatim"="The sandbox preserves native comment ownership."\n';
