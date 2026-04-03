export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const E164_REGEX = /^\+[1-9]\d{6,14}$/;

export const toE164Phone = (value: string, dialCode: string) => {
  const trimmedValue = value.trim();
  if (!trimmedValue) return '';

  if (trimmedValue.startsWith('+')) {
    const digits = trimmedValue.replace(/\D/g, '');
    return digits ? `+${digits}` : '';
  }

  const nationalNumber = trimmedValue.replace(/\D/g, '');
  return nationalNumber ? `${dialCode}${nationalNumber}` : '';
};

export const getPhoneAliasEmail = (phoneE164: string) => {
  const digits = phoneE164.replace(/\D/g, '');
  return `phone_${digits}@phone.shieldher.local`;
};
