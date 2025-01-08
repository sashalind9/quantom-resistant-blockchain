const { KyberUtils } = require("../crypto/KyberUtils");

class BlockValidation {
  static BLOCK_GENERATION_INTERVAL = 10000; // 10 seconds
  static DIFFICULTY_ADJUSTMENT_INTERVAL = 10; // blocks
  static MAX_BLOCK_SIZE = 1000000; // 1MB
  static MIN_DIFFICULTY = 4;
  static MAX_DIFFICULTY = 24;

  static isValidBlock(block, lastBlock) {
    return (
      this.validateBlockStructure(block) &&
      this.validateBlockHash(block) &&
      this.validateBlockChain(block, lastBlock) &&
      this.validateQuantumProof(block) &&
      this.validateBlockSize(block)
    );
  }

  static validateBlockStructure(block) {
    return (
      typeof block.timestamp === "number" &&
      typeof block.lastHash === "string" &&
      typeof block.hash === "string" &&
      Array.isArray(block.transactions) &&
      typeof block.nonce === "number" &&
      typeof block.difficulty === "number" &&
      block.quantumProof !== null
    );
  }

  static validateBlockHash(block) {
    const { timestamp, lastHash, transactions, nonce, difficulty } = block;
    const hash = Block.hash({
      timestamp,
      lastHash,
      transactions,
      nonce,
      difficulty,
    });

    return block.hash === hash;
  }

  static validateBlockChain(block, lastBlock) {
    if (!lastBlock) {
      return block.lastHash === "-----"; // Genesis block
    }

    return (
      block.lastHash === lastBlock.hash &&
      block.timestamp > lastBlock.timestamp &&
      Math.abs(block.difficulty - lastBlock.difficulty) <= 1
    );
  }

  static validateQuantumProof(block) {
    try {
      return KyberUtils.verifyBlockProof(block.hash, block.quantumProof, block.minerPublicKey);
    } catch (error) {
      console.error("Quantum proof validation failed:", error);
      return false;
    }
  }

  static validateBlockSize(block) {
    const blockSize = block.getBlockSize();
    return blockSize <= this.MAX_BLOCK_SIZE;
  }

  static adjustDifficulty({ originalBlock, timestamp }) {
    const { difficulty } = originalBlock;

    if (difficulty < this.MIN_DIFFICULTY) return this.MIN_DIFFICULTY;
    if (difficulty > this.MAX_DIFFICULTY) return this.MAX_DIFFICULTY;

    const timeDifference = timestamp - originalBlock.timestamp;

    if (timeDifference > this.BLOCK_GENERATION_INTERVAL * 2) {
      return Math.max(difficulty - 1, this.MIN_DIFFICULTY);
    } else if (timeDifference < this.BLOCK_GENERATION_INTERVAL / 2) {
      return Math.min(difficulty + 1, this.MAX_DIFFICULTY);
    }

    return difficulty;
  }

  static validateDifficultyAdjustment(blocks) {
    if (blocks.length < this.DIFFICULTY_ADJUSTMENT_INTERVAL) return true;

    const lastBlock = blocks[blocks.length - 1];
    const lastAdjustmentBlock = blocks[blocks.length - this.DIFFICULTY_ADJUSTMENT_INTERVAL];
    const expectedTime = this.BLOCK_GENERATION_INTERVAL * this.DIFFICULTY_ADJUSTMENT_INTERVAL;
    const actualTime = lastBlock.timestamp - lastAdjustmentBlock.timestamp;
    const deviation = Math.abs(actualTime - expectedTime);

    return deviation <= expectedTime / 4; // Allow 25% deviation
  }

  static validateMerkleRoot(block) {
    const calculatedRoot = block.calculateMerkleRoot();
    return block.merkleRoot === calculatedRoot;
  }

  static validateTransactionSequence(block) {
    return block.transactions.every((tx, index) => {
      if (index === 0) return true; // Coinbase transaction
      return (
        tx.timestamp <= block.timestamp && (index === 0 || tx.timestamp >= block.transactions[index - 1].timestamp)
      );
    });
  }
}

module.exports = BlockValidation;
