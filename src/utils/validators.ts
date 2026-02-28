const PHONE_REGEX = /^\+?[1-9]\d{7,14}$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;
const PASSWORD_MIN = 8;

interface SignupInput {
  phone_number?: string;
  full_name?: string;
  username?: string;
  password?: string;
}

interface LoginInput {
  phone_number?: string;
  password?: string;
}

export function validateSignup(data: SignupInput): string[] {
  const errors: string[] = [];

  if (!data.phone_number || !PHONE_REGEX.test(data.phone_number.trim())) {
    errors.push("phone_number: Must be a valid international phone number (e.g. +919876543210)");
  }

  if (!data.full_name || data.full_name.trim().length < 2 || data.full_name.trim().length > 150) {
    errors.push("full_name: Must be between 2 and 150 characters");
  }

  if (!data.username || !USERNAME_REGEX.test(data.username)) {
    errors.push("username: Must be 3–30 characters (letters, numbers, underscores only)");
  }

  if (!data.password || data.password.length < PASSWORD_MIN) {
    errors.push(`password: Must be at least ${PASSWORD_MIN} characters`);
  }

  if (data.password && !/[A-Z]/.test(data.password)) {
    errors.push("password: Must contain at least one uppercase letter");
  }

  if (data.password && !/[0-9]/.test(data.password)) {
    errors.push("password: Must contain at least one number");
  }

  return errors;
}

export function validateLogin(data: LoginInput): string[] {
  const errors: string[] = [];

  if (!data.phone_number || !PHONE_REGEX.test(data.phone_number.trim())) {
    errors.push("phone_number: Must be a valid phone number");
  }

  if (!data.password || data.password.length < 1) {
    errors.push("password: Required");
  }

  return errors;
}
