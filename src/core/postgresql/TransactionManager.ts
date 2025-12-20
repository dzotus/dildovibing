/**
 * Transaction Manager for PostgreSQL
 * Manages transactions with BEGIN, COMMIT, ROLLBACK support
 */

export interface Transaction {
  id: string;
  startTime: number;
  queries: TransactionQuery[];
  status: 'active' | 'committed' | 'rolled_back';
  isolationLevel: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
}

export interface TransactionQuery {
  sql: string;
  timestamp: number;
  result?: any;
  error?: string;
}

/**
 * Transaction Manager
 * Manages database transactions
 */
export class PostgreSQLTransactionManager {
  private transactions: Map<string, Transaction> = new Map();
  private transactionCounter = 0;

  /**
   * Begin a new transaction
   */
  begin(isolationLevel: Transaction['isolationLevel'] = 'READ COMMITTED'): string {
    const id = `txn_${++this.transactionCounter}_${Date.now()}`;
    const transaction: Transaction = {
      id,
      startTime: Date.now(),
      queries: [],
      status: 'active',
      isolationLevel,
    };
    this.transactions.set(id, transaction);
    return id;
  }

  /**
   * Add query to transaction
   */
  addQuery(transactionId: string, sql: string, result?: any, error?: string): boolean {
    const transaction = this.transactions.get(transactionId);
    if (!transaction || transaction.status !== 'active') {
      return false;
    }

    transaction.queries.push({
      sql,
      timestamp: Date.now(),
      result,
      error,
    });

    return true;
  }

  /**
   * Commit transaction
   */
  commit(transactionId: string): { success: boolean; error?: string } {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      return { success: false, error: 'Transaction not found' };
    }

    if (transaction.status !== 'active') {
      return { success: false, error: `Transaction is ${transaction.status}` };
    }

    // Check for errors in queries
    const hasErrors = transaction.queries.some((q) => q.error);
    if (hasErrors) {
      // Auto-rollback on error
      this.rollback(transactionId);
      return { success: false, error: 'Transaction contains errors, auto-rolled back' };
    }

    transaction.status = 'committed';
    // Keep transaction for a short time, then clean up
    setTimeout(() => {
      this.transactions.delete(transactionId);
    }, 5000);

    return { success: true };
  }

  /**
   * Rollback transaction
   */
  rollback(transactionId: string): { success: boolean; error?: string } {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      return { success: false, error: 'Transaction not found' };
    }

    if (transaction.status !== 'active') {
      return { success: false, error: `Transaction is ${transaction.status}` };
    }

    transaction.status = 'rolled_back';
    // Clean up immediately
    this.transactions.delete(transactionId);

    return { success: true };
  }

  /**
   * Get transaction by ID
   */
  getTransaction(transactionId: string): Transaction | undefined {
    return this.transactions.get(transactionId);
  }

  /**
   * Check if transaction is active
   */
  isActive(transactionId: string): boolean {
    const transaction = this.transactions.get(transactionId);
    return transaction?.status === 'active';
  }

  /**
   * Get all active transactions
   */
  getActiveTransactions(): Transaction[] {
    return Array.from(this.transactions.values()).filter((t) => t.status === 'active');
  }

  /**
   * Clean up old transactions
   */
  cleanup(maxAge: number = 60000): void {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [id, transaction] of this.transactions.entries()) {
      if (now - transaction.startTime > maxAge) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      this.transactions.delete(id);
    }
  }

  /**
   * Reset all transactions
   */
  reset(): void {
    this.transactions.clear();
    this.transactionCounter = 0;
  }
}

