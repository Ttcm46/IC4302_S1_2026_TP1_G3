/**
 * Validación de Política de Contraseña
 * 
 * Requisitos:
 * - Mínimo 8 caracteres
 * - Al menos 1 mayúscula (A-Z)
 * - Al menos 1 minúscula (a-z)
 * - Al menos 1 número (0-9)
 * - Al menos 1 símbolo especial (!@#$%^&*)
 */

export const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  hasUppercase: /[A-Z]/,
  hasLowercase: /[a-z]/,
  hasNumber: /[0-9]/,
  hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/
};

export const PASSWORD_MESSAGES = {
  minLength: 'Mínimo 8 caracteres',
  hasUppercase: 'Al menos 1 mayúscula (A-Z)',
  hasLowercase: 'Al menos 1 minúscula (a-z)',
  hasNumber: 'Al menos 1 número (0-9)',
  hasSpecialChar: 'Al menos 1 símbolo especial (!@#$%^&*...)'
};

/**
 * Valida una contraseña contra la política de seguridad
 * @param {string} password - Contraseña a validar
 * @returns {object} { isValid: boolean, errors: string[] }
 */
export function validatePassword(password) {
  const errors = [];

  if (!password) {
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
 * Retorna solo los requisitos NO cumplidos (para mostrar en UI)
 * @param {string} password - Contraseña a validar
 * @returns {string[]} Array de mensajes de errores
 */
export function getPasswordErrors(password) {
  return validatePassword(password).errors;
}

/**
 * Retorna true si la contraseña es válida
 * @param {string} password - Contraseña a validar
 * @returns {boolean}
 */
export function isPasswordValid(password) {
  return validatePassword(password).isValid;
}
