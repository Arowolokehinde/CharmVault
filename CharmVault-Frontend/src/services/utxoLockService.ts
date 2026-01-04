/**
 * UTXO Lock Service
 *
 * Manages UTXO locks to prevent double spending during vault/savings creation.
 * Locks are persisted to localStorage to survive page refreshes and browser crashes.
 * Locks auto-expire after 15 minutes to handle stuck transactions.
 */

export interface LockedUTXO {
  utxoId: string
  lockedAt: number
  lockType: 'creating_vault' | 'creating_savings'
  expiresAt: number
}

class UTXOLockService {
  private static STORAGE_KEY = 'charmvault_locked_utxos'
  private static LOCK_TIMEOUT = 15 * 60 * 1000 // 15 minutes

  /**
   * Lock a UTXO (reserve it for proving)
   * @param utxoId - UTXO identifier in format "txid:vout"
   * @param lockType - Type of operation locking the UTXO
   */
  lockUTXO(utxoId: string, lockType: 'creating_vault' | 'creating_savings'): void {
    const lockedUTXOs = this.load()
    const now = Date.now()

    // Check if already locked
    const existing = lockedUTXOs.find((u) => u.utxoId === utxoId)
    if (existing) {
      console.warn(`🔒 UTXO ${utxoId} is already locked since ${new Date(existing.lockedAt).toISOString()}`)
      return
    }

    // Add new lock
    const newLock: LockedUTXO = {
      utxoId,
      lockedAt: now,
      lockType,
      expiresAt: now + UTXOLockService.LOCK_TIMEOUT,
    }

    lockedUTXOs.push(newLock)
    this.save(lockedUTXOs)

    console.log(`🔒 Locked UTXO ${utxoId} for ${lockType} (expires in ${UTXOLockService.LOCK_TIMEOUT / 1000 / 60} minutes)`)
  }

  /**
   * Unlock a UTXO (release reservation)
   * @param utxoId - UTXO identifier in format "txid:vout"
   */
  unlockUTXO(utxoId: string): void {
    const lockedUTXOs = this.load()
    const filtered = lockedUTXOs.filter((u) => u.utxoId !== utxoId)

    if (filtered.length === lockedUTXOs.length) {
      console.warn(`🔓 UTXO ${utxoId} was not locked (already unlocked or never locked)`)
      return
    }

    this.save(filtered)
    console.log(`🔓 Unlocked UTXO ${utxoId}`)
  }

  /**
   * Check if a UTXO is currently locked
   * @param utxoId - UTXO identifier in format "txid:vout"
   * @returns true if locked, false otherwise
   */
  isLocked(utxoId: string): boolean {
    const lockedUTXOs = this.load()
    const lock = lockedUTXOs.find((u) => u.utxoId === utxoId)

    if (!lock) {
      return false
    }

    // Check if lock has expired
    const now = Date.now()
    if (now >= lock.expiresAt) {
      console.log(`🔓 Lock expired for UTXO ${utxoId}, auto-unlocking`)
      this.unlockUTXO(utxoId)
      return false
    }

    return true
  }

  /**
   * Get all currently locked UTXOs (excluding expired ones)
   * @returns Array of locked UTXOs
   */
  getLockedUTXOs(): LockedUTXO[] {
    this.clearExpiredLocks()
    return this.load()
  }

  /**
   * Clear all expired locks (auto-unlock after timeout)
   * Called automatically during lock checks and can be called manually
   */
  clearExpiredLocks(): void {
    const lockedUTXOs = this.load()
    const now = Date.now()

    const activeLocks = lockedUTXOs.filter((lock) => {
      if (now >= lock.expiresAt) {
        console.log(`🔓 Auto-unlocking expired UTXO ${lock.utxoId} (locked for ${lock.lockType})`)
        return false
      }
      return true
    })

    if (activeLocks.length < lockedUTXOs.length) {
      this.save(activeLocks)
      console.log(`🧹 Cleared ${lockedUTXOs.length - activeLocks.length} expired lock(s)`)
    }
  }

  /**
   * Manually clear all locks (useful for debugging or recovery)
   */
  clearAllLocks(): void {
    localStorage.removeItem(UTXOLockService.STORAGE_KEY)
    console.log('🗑️ Cleared all UTXO locks')
  }

  /**
   * Save locked UTXOs to localStorage
   * @param lockedUTXOs - Array of locked UTXOs to save
   */
  private save(lockedUTXOs: LockedUTXO[]): void {
    try {
      localStorage.setItem(UTXOLockService.STORAGE_KEY, JSON.stringify(lockedUTXOs))
    } catch (error) {
      console.error('Failed to save UTXO locks to localStorage:', error)
    }
  }

  /**
   * Load locked UTXOs from localStorage
   * @returns Array of locked UTXOs
   */
  private load(): LockedUTXO[] {
    try {
      const stored = localStorage.getItem(UTXOLockService.STORAGE_KEY)
      if (!stored) {
        return []
      }

      const parsed = JSON.parse(stored)
      if (!Array.isArray(parsed)) {
        console.warn('Invalid UTXO lock data in localStorage, clearing')
        this.clearAllLocks()
        return []
      }

      return parsed
    } catch (error) {
      console.error('Failed to load UTXO locks from localStorage:', error)
      this.clearAllLocks()
      return []
    }
  }
}

// Export singleton instance
export const utxoLockService = new UTXOLockService()
export default utxoLockService
