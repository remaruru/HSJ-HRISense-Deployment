import crypto from 'crypto';

export function generateSecurePassword(length = 16): string {
  if (length < 12) length = 12;
  if (length > 16) length = 16;
  
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+~`|}{[]:;?><,./-=';

  const allChars = uppercase + lowercase + numbers + symbols;

  let password = '';
  // Ensure at least one of each required type using crypto.randomInt
  password += uppercase[crypto.randomInt(uppercase.length)];
  password += lowercase[crypto.randomInt(lowercase.length)];
  password += numbers[crypto.randomInt(numbers.length)];
  password += symbols[crypto.randomInt(symbols.length)];

  for (let i = 4; i < length; i++) {
    password += allChars[crypto.randomInt(allChars.length)];
  }

  // Shuffle the password securely without Math.random()
  const chars = password.split('');
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  
  return chars.join('');
}
