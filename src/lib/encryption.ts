// ─────────────────────────────────────────────
// Cifrado AES-256-GCM para datos sensibles en DB
// Requiere ENCRYPTION_KEY en variables de entorno:
//   openssl rand -hex 32   → genera un key válido (64 caracteres hex = 32 bytes)
// ─────────────────────────────────────────────

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES   = 12  // 96 bits — recomendado para GCM
const TAG_BYTES  = 16  // 128 bits de auth tag

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY debe ser 64 caracteres hexadecimales (32 bytes). ' +
      'Generá uno con: openssl rand -hex 32'
    )
  }
  return Buffer.from(hex, 'hex')
}

/**
 * Cifra un string con AES-256-GCM.
 * Retorna un string en formato: iv:authTag:ciphertext (todo hex).
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv  = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return [
    iv.toString('hex'),
    tag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':')
}

/**
 * Descifra un string cifrado con `encrypt()`.
 * Lanza error si el ciphertext fue alterado (GCM auth tag falla).
 */
export function decrypt(ciphertext: string): string {
  const key = getKey()
  const parts = ciphertext.split(':')
  if (parts.length !== 3) throw new Error('Formato de ciphertext inválido')

  const [ivHex, tagHex, dataHex] = parts
  const iv       = Buffer.from(ivHex,   'hex')
  const tag      = Buffer.from(tagHex,  'hex')
  const data     = Buffer.from(dataHex, 'hex')

  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error('IV o auth tag con longitud inválida')
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  return decipher.update(data).toString('utf8') + decipher.final('utf8')
}

/**
 * Descifra de forma segura — retorna null si falla (campo vacío o no cifrado aún).
 * Incluye detección de plaintext para compatibilidad durante migración:
 * si el valor no tiene el formato iv:tag:data se retorna tal cual.
 */
export function safeDecrypt(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    // Detectar formato cifrado: exactamente 2 separadores ':'
    const parts = value.split(':')
    if (parts.length !== 3) {
      // Plaintext legacy — devolver como está (migración pendiente)
      return value
    }
    return decrypt(value)
  } catch {
    // Si GCM falla (alteración o key incorrecta) → null, no exponer datos
    return null
  }
}
