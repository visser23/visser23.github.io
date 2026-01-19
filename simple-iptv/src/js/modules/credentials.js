/**
 * Credentials Module
 * Handles credential encoding (Base64) and vault encryption (PIN)
 * 
 * Note: Base64 encoding provides light obfuscation only - it's not security.
 * For actual security, use the PIN vault mode which uses AES-GCM encryption.
 */

import { local, KEYS, getSettings } from './storage.js';

// =============================================================================
// Simple Base64 Encoding
// =============================================================================

/**
 * Encode credentials to Base64
 * @param {Object} creds - Credentials object
 * @returns {string} - Base64 encoded string
 */
export function obfuscate(creds) {
  try {
    const json = JSON.stringify(creds);
    // Use encodeURIComponent to handle Unicode characters before btoa
    const encoded = btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/g,
      (match, p1) => String.fromCharCode('0x' + p1)
    ));
    return encoded;
  } catch (e) {
    console.error('[Credentials] Encoding failed:', e);
    throw e;
  }
}

/**
 * Decode Base64 credentials
 * @param {string} encoded - Base64 string
 * @returns {Object|null} - Credentials or null if invalid
 */
export function deobfuscate(encoded) {
  try {
    // Handle old format (cheat-code with dashes) - clear it
    if (encoded.includes('-')) {
      return null;
    }
    
    // Decode Base64
    const decoded = decodeURIComponent(atob(encoded).split('').map(c =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''));
    
    return JSON.parse(decoded);
  } catch (e) {
    console.error('[Credentials] Decoding failed:', e);
    return null;
  }
}

// =============================================================================
// Vault Encryption (PIN-protected)
// =============================================================================

/**
 * Derive AES key from PIN using PBKDF2
 */
async function deriveKey(pin, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt credentials with PIN
 */
export async function encryptWithPin(creds, pin) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const key = await deriveKey(pin, salt);
  
  const plaintext = encoder.encode(JSON.stringify(creds));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );
  
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    salt: btoa(String.fromCharCode(...salt)),
    iv: btoa(String.fromCharCode(...iv))
  };
}

/**
 * Decrypt credentials with PIN
 */
export async function decryptWithPin(vault, pin) {
  try {
    const ciphertext = Uint8Array.from(atob(vault.ciphertext), c => c.charCodeAt(0));
    const salt = Uint8Array.from(atob(vault.salt), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(vault.iv), c => c.charCodeAt(0));
    
    const key = await deriveKey(pin, salt);
    
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(plaintext));
  } catch (e) {
    // Decryption failed - likely wrong PIN
    return null;
  }
}

// =============================================================================
// High-level API
// =============================================================================

// In-memory cache for current session
let cachedCredentials = null;

/**
 * Store credentials
 */
export async function storeCredentials(creds, remember = true, pin = null) {
  // Always cache in memory
  cachedCredentials = creds;
  
  if (!remember) {
    local.remove(KEYS.CREDENTIALS);
    return true;
  }
  
  const settings = getSettings();
  
  if (settings.vaultEnabled && pin) {
    const vault = await encryptWithPin(creds, pin);
    local.set(KEYS.CREDENTIALS, { vault, mode: creds.mode });
  } else {
    const obfuscated = obfuscate(creds);
    local.set(KEYS.CREDENTIALS, { obfuscated, mode: creds.mode });
  }
  
  return true;
}

/**
 * Retrieve credentials
 */
export async function getCredentials(pin = null) {
  // Return cached if available
  if (cachedCredentials) {
    return cachedCredentials;
  }
  
  const stored = local.get(KEYS.CREDENTIALS);
  if (!stored) return null;
  
  let creds = null;
  
  if (stored.vault) {
    if (!pin) return null; // PIN required
    creds = await decryptWithPin(stored.vault, pin);
  } else if (stored.obfuscated) {
    creds = deobfuscate(stored.obfuscated);
    
    if (!creds) {
      // Clear corrupted data
      local.remove(KEYS.CREDENTIALS);
      return null;
    }
  }
  
  if (creds) {
    cachedCredentials = creds;
  }
  
  return creds;
}

/**
 * Check if credentials are stored (and valid)
 */
export function hasStoredCredentials() {
  try {
    const stored = local.get(KEYS.CREDENTIALS);
    if (!stored) return false;
    
    if (stored.vault) {
      return !!(stored.vault.ciphertext && stored.vault.salt && stored.vault.iv);
    }
    if (stored.obfuscated) {
      return typeof stored.obfuscated === 'string' && stored.obfuscated.length > 0;
    }
    
    // Invalid format - clear it
    local.remove(KEYS.CREDENTIALS);
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Check if vault mode (needs PIN to unlock)
 */
export function needsPin() {
  try {
    const stored = local.get(KEYS.CREDENTIALS);
    if (!stored || !stored.vault) return false;
    return !!(stored.vault.ciphertext && stored.vault.salt && stored.vault.iv);
  } catch (e) {
    return false;
  }
}

/**
 * Clear credentials (memory + storage)
 */
export function clearCredentials() {
  cachedCredentials = null;
  local.remove(KEYS.CREDENTIALS);
}

/**
 * Enable vault mode and re-encrypt current credentials
 */
export async function enableVault(pin) {
  if (!cachedCredentials) {
    throw new Error('No credentials to encrypt');
  }
  
  const vault = await encryptWithPin(cachedCredentials, pin);
  local.set(KEYS.CREDENTIALS, { vault, mode: cachedCredentials.mode });
  return true;
}

/**
 * Disable vault mode and switch to obfuscation
 */
export function disableVault() {
  if (!cachedCredentials) {
    throw new Error('No credentials to convert');
  }
  
  const obfuscated = obfuscate(cachedCredentials);
  local.set(KEYS.CREDENTIALS, { obfuscated, mode: cachedCredentials.mode });
  return true;
}

/**
 * Get the current credentials mode description
 */
export function getCredentialsMode() {
  const stored = local.get(KEYS.CREDENTIALS);
  if (!stored) return 'None';
  if (stored.vault) return 'Vault (PIN encrypted)';
  if (stored.obfuscated) return 'Encoded';
  return 'Unknown';
}
