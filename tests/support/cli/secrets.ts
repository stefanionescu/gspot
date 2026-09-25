// A planted credential for the secrets tests, built from halves so no scanner of this repository reads a key here.
export const PLANTED_KEY_ID = ['AKIA', 'IOSFODNN7', 'EXAMPLA'].join('');

/** A settings file that holds the planted credential. */
export const PLANTED_SETTINGS = `aws_access_key_id = "${PLANTED_KEY_ID}"\n`;
