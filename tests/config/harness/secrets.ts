// Build the scanner fixture from halves so repository scans do not read a credential here.
export const testKeyId = 'AKIA' + 'IOSFODNN7' + 'EXAMPLA';

/** A settings file containing the test credential. */
export const secretSettings = `aws_access_key_id = "${testKeyId}"\n`;

/** An inert high-entropy API token exercises redacted generic-key reports. */
export const testApiToken = 'n3K5p7R9' + 't2V4w6Y8' + 'z1A3c5E7' + 'g9I2m4O6';
