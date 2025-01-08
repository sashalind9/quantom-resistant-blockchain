const Block = require("./Block");
const { KyberUtils } = require("../crypto/KyberUtils");
const { BlockValidation } = require("../validation/BlockValidation");
const { LevelDB } = require("../storage/LevelDB");

class Blockchain {
  constructor() {
    this.chain = [Block.genesis()];
    this.mempool = new Map();
    this.db = new LevelDB();
    this.quantumKeyPair = null;
  }

  async initialize() {
    // Load chain from database
    const storedChain = await this.db.getChain();
    if (storedChain && storedChain.length > 0) {
      this.chain = storedChain;
    }

    // Generate quantum-resistant keypair
    this.quantumKeyPair = await KyberUtils.generateKeyPair();
  }

  async addBlock(transactions) {
    const lastBlock = this.chain[this.chain.length - 1];
    const newBlock = await Block.mineBlock({
      lastBlock,
      transactions,
      quantumKeyPair: this.quantumKeyPair,
    });

    if (this.isValidNewBlock(newBlock)) {
      this.chain.push(newBlock);
      await this.db.saveBlock(newBlock);
      this.clearMempool(transactions);
      return newBlock;
    }

    throw new Error("Invalid block");
  }

  isValidNewBlock(block) {
    const lastBlock = this.chain[this.chain.length - 1];
    return (
      BlockValidation.isValidBlock(block, lastBlock) &&
      BlockValidation.validateMerkleRoot(block) &&
      BlockValidation.validateTransactionSequence(block)
    );
  }

  isValidChain(chain) {
    if (JSON.stringify(chain[0]) !== JSON.stringify(Block.genesis())) {
      return false;
    }

    for (let i = 1; i < chain.length; i++) {
      const block = chain[i];
      const lastBlock = chain[i - 1];

      if (!BlockValidation.isValidBlock(block, lastBlock)) {
        return false;
      }
    }

    return BlockValidation.validateDifficultyAdjustment(chain);
  }

  async replaceChain(newChain) {
    if (newChain.length <= this.chain.length) {
      throw new Error("Received chain is not longer than current chain");
    }

    if (!this.isValidChain(newChain)) {
      throw new Error("Received chain is invalid");
    }

    try {
      await this.db.saveChain(newChain);
      this.chain = newChain;
      return true;
    } catch (error) {
      console.error("Chain replacement failed:", error);
      return false;
    }
  }

  addToMempool(transaction) {
    const txHash = transaction.hash;
    if (!this.mempool.has(txHash) && this.isValidTransaction(transaction)) {
      this.mempool.set(txHash, transaction);
      return true;
    }
    return false;
  }

  getMempoolTransactions() {
    return Array.from(this.mempool.values());
  }

  clearMempool(confirmedTransactions) {
    confirmedTransactions.forEach((tx) => {
      this.mempool.delete(tx.hash);
    });
  }

  isValidTransaction(transaction) {
    // Basic transaction validation
    if (!transaction || !transaction.hash || !transaction.signature) {
      return false;
    }

    // Check if transaction is already in blockchain
    const isInChain = this.chain.some((block) => block.transactions.some((tx) => tx.hash === transaction.hash));

    if (isInChain) return false;

    // Verify quantum-resistant signature
    try {
      return KyberUtils.verifySignature(transaction.hash, transaction.signature, transaction.senderPublicKey);
    } catch (error) {
      console.error("Transaction signature verification failed:", error);
      return false;
    }
  }

  async getBlockByHash(hash) {
    return await this.db.getBlockByHash(hash);
  }

  async getBlockByHeight(height) {
    if (height < 0 || height >= this.chain.length) {
      return null;
    }
    return this.chain[height];
  }

  getBlockHeight() {
    return this.chain.length - 1;
  }

  async getBalance(address) {
    let balance = 0;
    for (const block of this.chain) {
      for (const tx of block.transactions) {
        if (tx.recipient === address) balance += tx.amount;
        if (tx.sender === address) balance -= tx.amount;
      }
    }
    return balance;
  }

  getPublicKey() {
    return this.quantumKeyPair.publicKey;
  }

  async generateBlockCandidate(transactions) {
    const lastBlock = this.chain[this.chain.length - 1];
    return Block.mineBlock({
      lastBlock,
      transactions,
      quantumKeyPair: this.quantumKeyPair,
    });
  }
}

module.exports = Blockchain;
