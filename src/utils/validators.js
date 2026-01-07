const validators = {
    // Email validation
    isValidEmail: (email) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    },
  
    // Password validation (min 6 characters for MVP)
    isValidPassword: (password) => {
      return password && password.length >= 6;
    },
  
    // Business name validation
    isValidBusinessName: (name) => {
      return name && name.trim().length >= 2;
    },
  
    // Sanitize input
    sanitizeInput: (input) => {
      if (typeof input !== 'string') return input;
      return input.trim();
    }
  };
  
  module.exports = validators;
  