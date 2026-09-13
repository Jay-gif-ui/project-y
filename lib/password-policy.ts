export const PASSWORD_MIN_LENGTH = 12;

export function passwordValidationError(password: string) {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Include at least one letter and one number.";
  return null;
}
