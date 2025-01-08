class Mempool {
  constructor() {
    this.transactions = new Map();
    this.maxSize = 5000; // Maximum number of transactions
    this.maxTransactionAge = 3600000; // 1 hour in milliseconds
  }

  addTransaction(transaction) {
    if (this.transactions.size >= this.maxSize) {
      this.removeOldTransactions();
    }

    if (!this.transactions.has(transaction.hash)) {
      this.transactions.set(transaction.hash, {
        transaction,
        timestamp: Date.now(),
      });
      return true;
    }

    return false;
  }

  removeTransaction(transactionHash) {
    return this.transactions.delete(transactionHash);
  }

  getTransaction(transactionHash) {
    const entry = this.transactions.get(transactionHash);
    return entry ? entry.transaction : null;
  }

  getMempoolTransactions() {
    return Array.from(this.transactions.values()).map((entry) => entry.transaction);
  }

  clear() {
    this.transactions.clear();
  }

  removeOldTransactions() {
    const now = Date.now();
    for (const [hash, entry] of this.transactions.entries()) {
      if (now - entry.timestamp > this.maxTransactionAge) {
        this.transactions.delete(hash);
      }
    }
  }

  removeConfirmedTransactions(confirmedTransactions) {
    for (const tx of confirmedTransactions) {
      this.transactions.delete(tx.hash);
    }
  }

  hasTransaction(transactionHash) {
    return this.transactions.has(transactionHash);
  }

  getSize() {
    return this.transactions.size;
  }

  getTransactionsByAddress(address) {
    return Array.from(this.transactions.values())
      .filter((entry) => entry.transaction.sender === address || entry.transaction.recipient === address)
      .map((entry) => entry.transaction);
  }

  getPendingBalance(address) {
    let balance = 0;
    for (const entry of this.transactions.values()) {
      const tx = entry.transaction;
      if (tx.recipient === address) balance += tx.amount;
      if (tx.sender === address) balance -= tx.amount;
    }
    return balance;
  }

  validateTransaction(transaction, blockchain) {
    // Check if transaction is already in mempool
    if (this.hasTransaction(transaction.hash)) {
      return false;
    }

    // Check if transaction is already in blockchain
    if (blockchain.hasTransaction(transaction.hash)) {
      return false;
    }

    // Verify transaction signature
    if (!transaction.verify()) {
      return false;
    }

    // Check sender's balance (including pending transactions)
    const accountBalance = blockchain.getBalance(transaction.sender);
    const pendingBalance = this.getPendingBalance(transaction.sender);
    if (accountBalance + pendingBalance < transaction.amount) {
      return false;
    }

    return true;
  }

  getTransactionsByTimeRange(startTime, endTime) {
    return Array.from(this.transactions.values())
      .filter((entry) => entry.timestamp >= startTime && entry.timestamp <= endTime)
      .map((entry) => entry.transaction);
  }

  prioritizeTransactions(maxCount = 100) {
    // Sort transactions by fee per byte and timestamp
    return Array.from(this.transactions.values())
      .sort((a, b) => {
        const feePerByteA = a.transaction.fee / a.transaction.getSize();
        const feePerByteB = b.transaction.fee / b.transaction.getSize();

        if (feePerByteA !== feePerByteB) {
          return feePerByteB - feePerByteA; // Higher fee per byte first
        }

        return a.timestamp - b.timestamp; // Older transactions first
      })
      .slice(0, maxCount)
      .map((entry) => entry.transaction);
  }

  cleanMempool(blockchain) {
    for (const [hash, entry] of this.transactions.entries()) {
      if (!this.validateTransaction(entry.transaction, blockchain)) {
        this.transactions.delete(hash);
      }
    }
  }
}

module.exports = { Mempool };
