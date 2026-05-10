import { z } from 'zod';

export const TransactionType = z.enum([
  'value_creation',
  'resource_consumption',
  'penalty',
  'reward',
  'settlement',
]);

export type TransactionTypeEnum = z.infer<typeof TransactionType>;

export const LedgerEntrySchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  entityId: z.string(),
  type: TransactionType,
  amount: z.number(),
  currency: z.string().default('CREDIT'),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;

/**
 * Value Attribution Engine (Ledger)
 * Implements SC-4.1
 */
export class Ledger {
  private entries: LedgerEntry[] = [];

  /**
   * Records a new transaction in the ledger.
   */
  record(entry: Omit<LedgerEntry, 'id' | 'timestamp' | 'currency'> & { currency?: string }): LedgerEntry {
    const newEntry: LedgerEntry = {
      ...entry,
      id: `txn-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      currency: entry.currency || 'CREDIT',
    };
    
    this.entries.push(newEntry);
    return newEntry;
  }

  /**
   * Retrieves the current balance for a specific entity.
   */
  getBalance(entityId: string, currency: string = 'CREDIT'): number {
    return this.entries
      .filter((e) => e.entityId === entityId && e.currency === currency)
      .reduce((sum, entry) => {
        // Debits (consumption/penalty) subtract, Credits (creation/reward/settlement) add.
        // Assuming amount is always positive and type dictates sign, or amount is signed.
        // Let's assume amount is signed (positive = credit, negative = debit) for simplicity,
        // or we handle sign based on type. Let's use signed amounts.
        return sum + entry.amount;
      }, 0);
  }

  /**
   * Retrieves all transaction history for an entity.
   */
  getHistory(entityId: string): LedgerEntry[] {
    return this.entries.filter((e) => e.entityId === entityId);
  }

  /**
   * Calculates the total value created across all entities.
   */
  getTotalValueCreated(currency: string = 'CREDIT'): number {
    return this.entries
      .filter((e) => e.type === 'value_creation' && e.currency === currency)
      .reduce((sum, entry) => sum + entry.amount, 0);
  }
}
