export const BROKEN =
    'level = "all"\nconfigurations = ["swift"]\nrequire_reasons = true\n[[ignore]]\ncheck = "swift/trivial-functions"\npaths = ["Sources/Other.swift"]\n';

export const CORRECTED = `${BROKEN}reason = "The protocol entry point forwards by design."\n`;
