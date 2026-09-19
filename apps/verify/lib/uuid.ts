/** A version-4 UUID, the only shape a certificate id can have. Anything else is not looked up. */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const isCertificateId = (value: string): boolean => UUID_PATTERN.test(value);
