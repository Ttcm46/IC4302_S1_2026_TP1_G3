/**
 * Password Policy Validation - Backend Version (Node.js)
 * 
 * Requirements:
 * - Minimum 8 characters
 * - At least 1 uppercase letter (A-Z)
 * - At least 1 lowercase letter (a-z)
 * - At least 1 number (0-9)
 * - At least 1 special character (!@#$%^&*)
 */

const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  hasUppercase: /[A-Z]/,
  hasLowercase: /[a-z]/,
  hasNumber: /[0-9]/,
  hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/
};

const PASSWORD_MESSAGES = {
  minLength: 'Mínimo 8 caracteres',
  hasUppercase: 'Al menos 1 mayúscula (A-Z)',
  hasLowercase: 'Al menos 1 minúscula (a-z)',
  hasNumber: 'Al menos 1 número (0-9)',
  hasSpecialChar: 'Al menos 1 símbolo especial (!@#$%^&*...)'
};

/**
 * Validates a password against security policy
 * @param {string} password - Password to validate
 * @returns {object} { isValid: boolean, errors: string[] }
 */
function validatePassword(password) {
  const errors = [];

  if (!password || typeof password !== 'string') {
    errors.push('La contraseña es requerida');
    return { isValid: false, errors };
  }

  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(PASSWORD_MESSAGES.minLength);
  }

  if (!PASSWORD_REQUIREMENTS.hasUppercase.test(password)) {
    errors.push(PASSWORD_MESSAGES.hasUppercase);
  }

  if (!PASSWORD_REQUIREMENTS.hasLowercase.test(password)) {
    errors.push(PASSWORD_MESSAGES.hasLowercase);
  }

  if (!PASSWORD_REQUIREMENTS.hasNumber.test(password)) {
    errors.push(PASSWORD_MESSAGES.hasNumber);
  }

  if (!PASSWORD_REQUIREMENTS.hasSpecialChar.test(password)) {
    errors.push(PASSWORD_MESSAGES.hasSpecialChar);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Returns true if password is valid
 * @param {string} password - Password to validate
 * @returns {boolean}
 */
function isPasswordValid(password) {
  return validatePassword(password).isValid;
}

export { validatePassword, isPasswordValid };
