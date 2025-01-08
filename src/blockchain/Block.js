const { blake3 } = require("blake3");
const { MerkleTree } = require("merkletreejs");
const { KyberUtils } = require("../crypto/KyberUtils");
const { BlockValidation } = require("../validation/BlockValidation");

class Block {
  constructor({
    timestamp = Date.now(),
    lastHash,
    hash,
    transactions = [],
    nonce = 0,
    difficulty = 4,
    quantumProof = null,
  }) {
    this.timestamp = timestamp;
    this.lastHash = lastHash;
    this.hash = hash;
    this.transactions = transactions;
    this.nonce = nonce;
    this.difficulty = difficulty;
    this.quantumProof = quantumProof;
    this.merkleRoot = this.calculateMerkleRoot();
  }

  static genesis() {
    return new this({
      timestamp: 1683900000000,
      lastHash: "-----",
      hash: "genesis-hash",
      transactions: [],
      difficulty: 4,
      quantumProof: KyberUtils.generateInitialQuantumProof(),
    });
  }

  static mineBlock({ lastBlock, transactions, quantumKeyPair }) {
    let timestamp = Date.now();
    const lastHash = lastBlock.hash;
    let { difficulty } = lastBlock;
    let nonce = 0;
    let hash;

    // Adjust difficulty based on mining rate
    difficulty = BlockValidation.adjustDifficulty({
      originalBlock: lastBlock,
      timestamp,
    });

    do {
      nonce++;
      timestamp = Date.now();
      hash = Block.hash({
        timestamp,
        lastHash,
        transactions,
        nonce,
        difficulty,
      });
    } while (hash.substring(0, difficulty) !== "0".repeat(difficulty));

    // Generate quantum-resistant proof
    const quantumProof = KyberUtils.generateBlockProof(hash, quantumKeyPair);

    return new this({
      timestamp,
      lastHash,
      hash,
      transactions,
      nonce,
      difficulty,
      quantumProof,
    });
  }

  static hash({ timestamp, lastHash, transactions, nonce, difficulty }) {
    const data = `${timestamp}${lastHash}${JSON.stringify(transactions)}${nonce}${difficulty}`;
    return blake3.hash(data).toString("hex");
  }

  calculateMerkleRoot() {
    if (this.transactions.length === 0) return null;

    const leaves = this.transactions.map((tx) => Buffer.from(Block.hash(tx), "hex"));

    const tree = new MerkleTree(leaves, blake3);
    return tree.getRoot().toString("hex");
  }

  getBlockSize() {
    return Buffer.from(JSON.stringify(this)).length;
  }

  verifyQuantumProof() {
    return KyberUtils.verifyBlockProof(this.hash, this.quantumProof);
  }

  toJSON() {
    return {
      timestamp: this.timestamp,
      lastHash: this.lastHash,
      hash: this.hash,
      transactions: this.transactions,
      nonce: this.nonce,
      difficulty: this.difficulty,
      quantumProof: this.quantumProof,
      merkleRoot: this.merkleRoot,
    };
  }
}

module.exports = Block;
