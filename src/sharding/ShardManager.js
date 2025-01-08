const { KyberUtils } = require("../crypto/KyberUtils");
const { blake3 } = require("blake3");
const config = require("../config/config");

class ShardManager {
  constructor(blockchain) {
    this.blockchain = blockchain;
    this.shards = new Map();
    this.shardValidators = new Map();
    this.crossShardTransactions = new Map();
    this.totalShards = config.sharding.totalShards;
    this.minValidatorsPerShard = config.sharding.minValidatorsPerShard;
  }

  async initializeShards() {
    for (let i = 0; i < this.totalShards; i++) {
      const shardId = await this.generateShardId(i);
      this.shards.set(shardId, {
        id: shardId,
        chain: [],
        state: new Map(),
        pendingTransactions: new Map(),
        lastProcessedBlock: null,
        validatorSet: new Set(),
      });
    }
  }

  async generateShardId(index) {
    const data = `shard-${index}-${Date.now()}`;
    const hash = blake3.hash(data).toString("hex");

    // Add quantum resistance to shard ID generation
    const quantumProof = await KyberUtils.generateShardIdProof(hash);
    return blake3.hash(quantumProof).toString("hex");
  }

  async assignValidatorToShard(validatorPublicKey, signature) {
    // Verify quantum-resistant signature
    const signatureData = Buffer.from(validatorPublicKey);
    const isValid = await KyberUtils.verifySignature(signatureData, signature, validatorPublicKey);

    if (!isValid) {
      throw new Error("Invalid validator signature");
    }

    // Find shard with fewest validators
    let targetShard = null;
    let minValidators = Infinity;

    for (const [shardId, shard] of this.shards.entries()) {
      if (shard.validatorSet.size < minValidators) {
        minValidators = shard.validatorSet.size;
        targetShard = shardId;
      }
    }

    if (!targetShard) {
      throw new Error("No available shards");
    }

    // Add validator to shard
    const shard = this.shards.get(targetShard);
    shard.validatorSet.add(validatorPublicKey);
    this.shardValidators.set(validatorPublicKey, targetShard);

    return targetShard;
  }

  async processTransaction(transaction) {
    const shardId = this.getTransactionShard(transaction);
    const shard = this.shards.get(shardId);

    if (!shard) {
      throw new Error("Invalid shard");
    }

    if (this.isCrossShardTransaction(transaction)) {
      return this.processCrossShardTransaction(transaction);
    }

    shard.pendingTransactions.set(transaction.hash, transaction);
    return shardId;
  }

  getTransactionShard(transaction) {
    // Deterministic shard assignment based on sender address
    const addressHash = blake3.hash(transaction.sender).toString("hex");
    const shardIndex = BigInt("0x" + addressHash) % BigInt(this.totalShards);
    return Array.from(this.shards.keys())[Number(shardIndex)];
  }

  isCrossShardTransaction(transaction) {
    const senderShard = this.getTransactionShard(transaction);
    const recipientShard = this.getAddressShard(transaction.recipient);
    return senderShard !== recipientShard;
  }

  async processCrossShardTransaction(transaction) {
    const sourceShard = this.getTransactionShard(transaction);
    const targetShard = this.getAddressShard(transaction.recipient);

    // Create quantum-resistant cross-shard proof
    const proof = await this.generateCrossShardProof(transaction, sourceShard, targetShard);

    const crossShardTx = {
      transaction,
      sourceShard,
      targetShard,
      proof,
      status: "pending",
      timestamp: Date.now(),
    };

    this.crossShardTransactions.set(transaction.hash, crossShardTx);

    // Add to both shards' pending transactions
    this.shards.get(sourceShard).pendingTransactions.set(transaction.hash, transaction);
    this.shards.get(targetShard).pendingTransactions.set(transaction.hash, transaction);

    return { sourceShard, targetShard };
  }

  async generateCrossShardProof(transaction, sourceShard, targetShard) {
    const data = `${transaction.hash}${sourceShard}${targetShard}`;
    const hash = blake3.hash(data).toString("hex");

    // Generate quantum-resistant proof
    return await KyberUtils.generateCrossShardProof(hash);
  }

  getAddressShard(address) {
    const addressHash = blake3.hash(address).toString("hex");
    const shardIndex = BigInt("0x" + addressHash) % BigInt(this.totalShards);
    return Array.from(this.shards.keys())[Number(shardIndex)];
  }

  async validateCrossShardTransaction(transaction, proof) {
    const sourceShard = this.getTransactionShard(transaction);
    const targetShard = this.getAddressShard(transaction.recipient);

    // Verify quantum-resistant cross-shard proof
    const data = `${transaction.hash}${sourceShard}${targetShard}`;
    return await KyberUtils.verifyCrossShardProof(data, proof);
  }

  async finalizeBlock(shardId, block, validatorSignatures) {
    const shard = this.shards.get(shardId);
    if (!shard) {
      throw new Error("Invalid shard");
    }

    // Verify quantum-resistant validator signatures
    const validSignatures = await this.verifyValidatorSignatures(block, validatorSignatures);
    if (validSignatures.size < this.minValidatorsPerShard) {
      throw new Error("Insufficient validator signatures");
    }

    // Process cross-shard transactions
    await this.processCrossShardTransactions(block);

    // Update shard state
    shard.chain.push(block);
    shard.lastProcessedBlock = block;

    // Clear processed transactions
    for (const tx of block.transactions) {
      shard.pendingTransactions.delete(tx.hash);
    }

    return block;
  }

  async verifyValidatorSignatures(block, signatures) {
    const validSignatures = new Set();
    const blockHash = block.hash;

    for (const [validatorKey, signature] of signatures) {
      const isValid = await KyberUtils.verifySignature(Buffer.from(blockHash), signature, validatorKey);

      if (isValid) {
        validSignatures.add(validatorKey);
      }
    }

    return validSignatures;
  }

  async processCrossShardTransactions(block) {
    for (const tx of block.transactions) {
      if (this.crossShardTransactions.has(tx.hash)) {
        const crossShardTx = this.crossShardTransactions.get(tx.hash);

        if (crossShardTx.status === "pending") {
          await this.updateCrossShardTransaction(tx.hash, "processing");
        } else if (crossShardTx.status === "processing") {
          await this.finalizeCrossShardTransaction(tx.hash);
        }
      }
    }
  }

  async updateCrossShardTransaction(txHash, status) {
    const crossShardTx = this.crossShardTransactions.get(txHash);
    if (crossShardTx) {
      crossShardTx.status = status;
      this.crossShardTransactions.set(txHash, crossShardTx);
    }
  }

  async finalizeCrossShardTransaction(txHash) {
    const crossShardTx = this.crossShardTransactions.get(txHash);
    if (!crossShardTx) return;

    // Generate quantum-resistant finalization proof
    const proof = await this.generateFinalizationProof(crossShardTx);

    // Update both shards
    const sourceShard = this.shards.get(crossShardTx.sourceShard);
    const targetShard = this.shards.get(crossShardTx.targetShard);

    sourceShard.pendingTransactions.delete(txHash);
    targetShard.pendingTransactions.delete(txHash);

    // Mark as completed
    crossShardTx.status = "completed";
    crossShardTx.finalizationProof = proof;
    crossShardTx.completedAt = Date.now();

    this.crossShardTransactions.set(txHash, crossShardTx);
  }

  async generateFinalizationProof(crossShardTx) {
    const data = `${crossShardTx.transaction.hash}${crossShardTx.sourceShard}${
      crossShardTx.targetShard
    }${Date.now()}`;
    const hash = blake3.hash(data).toString("hex");
    return await KyberUtils.generateFinalizationProof(hash);
  }

  getShardInfo(shardId) {
    const shard = this.shards.get(shardId);
    if (!shard) return null;

    return {
      id: shard.id,
      chainLength: shard.chain.length,
      validatorCount: shard.validatorSet.size,
      pendingTransactions: shard.pendingTransactions.size,
      lastProcessedBlock: shard.lastProcessedBlock
        ? {
            hash: shard.lastProcessedBlock.hash,
            timestamp: shard.lastProcessedBlock.timestamp,
          }
        : null,
    };
  }

  getAllShardsInfo() {
    const info = [];
    for (const [shardId, shard] of this.shards.entries()) {
      info.push(this.getShardInfo(shardId));
    }
    return info;
  }

  getValidatorShard(validatorPublicKey) {
    return this.shardValidators.get(validatorPublicKey);
  }

  getCrossShardTransactionStatus(txHash) {
    const tx = this.crossShardTransactions.get(txHash);
    if (!tx) return null;

    return {
      hash: txHash,
      status: tx.status,
      sourceShard: tx.sourceShard,
      targetShard: tx.targetShard,
      timestamp: tx.timestamp,
      completedAt: tx.completedAt,
    };
  }
}

module.exports = ShardManager;
