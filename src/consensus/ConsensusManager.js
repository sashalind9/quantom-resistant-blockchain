const { KyberUtils } = require("../crypto/KyberUtils");
const config = require("../config/config");

class ConsensusManager {
  constructor(blockchain) {
    this.blockchain = blockchain;
    this.validators = new Map();
    this.currentEpoch = 0;
    this.epochBlocks = new Map();
    this.minStake = config.consensus.validatorStake;
  }

  async registerValidator(address, stake, publicKey) {
    if (stake < this.minStake) {
      throw new Error(`Minimum stake requirement not met. Required: ${this.minStake}`);
    }

    if (this.validators.has(address)) {
      throw new Error("Validator already registered");
    }

    const validatorInfo = {
      address,
      stake,
      publicKey,
      blocksMined: 0,
      lastActive: Date.now(),
      reputation: 100,
      quantumProof: await KyberUtils.generateValidatorProof(publicKey),
    };

    this.validators.set(address, validatorInfo);
    return validatorInfo;
  }

  async selectNextValidator() {
    const activeValidators = Array.from(this.validators.values()).filter((v) => this.isValidatorActive(v));

    if (activeValidators.length < config.consensus.minValidators) {
      throw new Error("Not enough active validators");
    }

    // Quantum-resistant random selection weighted by stake
    const totalStake = activeValidators.reduce((sum, v) => sum + v.stake, 0);
    const randomValue = await this.generateQuantumRandomNumber(totalStake);

    let cumulativeStake = 0;
    for (const validator of activeValidators) {
      cumulativeStake += validator.stake;
      if (randomValue <= cumulativeStake) {
        return validator;
      }
    }

    return activeValidators[0];
  }

  async validateBlock(block, validator) {
    // Verify quantum-resistant block signature
    const isValidSignature = await KyberUtils.verifyBlockProof(
      block.hash,
      block.quantumProof,
      validator.publicKey
    );

    if (!isValidSignature) {
      return false;
    }

    // Verify validator's eligibility
    if (!this.isValidatorActive(validator)) {
      return false;
    }

    // Update validator statistics
    this.updateValidatorStats(validator.address, block);

    return true;
  }

  isValidatorActive(validator) {
    const inactiveThreshold = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
    return validator.lastActive > inactiveThreshold && validator.reputation >= 50;
  }

  updateValidatorStats(address, block) {
    const validator = this.validators.get(address);
    if (!validator) return;

    validator.blocksMined++;
    validator.lastActive = Date.now();

    // Update reputation based on block quality
    const blockQuality = this.assessBlockQuality(block);
    validator.reputation = Math.max(0, Math.min(100, validator.reputation + blockQuality));

    this.validators.set(address, validator);
  }

  assessBlockQuality(block) {
    let quality = 0;

    // Check block size
    if (block.getBlockSize() <= config.blockchain.maxBlockSize) {
      quality += 5;
    }

    // Check transaction count
    if (block.transactions.length <= config.blockchain.maxTransactionsPerBlock) {
      quality += 5;
    }

    // Check block propagation time
    const propagationTime = Date.now() - block.timestamp;
    if (propagationTime <= 1000) {
      // 1 second
      quality += 5;
    }

    return quality;
  }

  async generateQuantumRandomNumber(max) {
    const randomBuffer = await KyberUtils.generateRandomBytes(32);
    const randomValue = BigInt("0x" + randomBuffer.toString("hex"));
    return Number(randomValue % BigInt(max));
  }

  getValidatorInfo(address) {
    return this.validators.get(address);
  }

  getAllValidators() {
    return Array.from(this.validators.values());
  }

  getActiveValidators() {
    return this.getAllValidators().filter((v) => this.isValidatorActive(v));
  }

  calculateValidatorRewards(epoch) {
    const epochValidators = this.epochBlocks.get(epoch) || new Map();
    const rewards = new Map();

    for (const [address, blocks] of epochValidators.entries()) {
      const validator = this.validators.get(address);
      if (!validator) continue;

      const baseReward = blocks.length * config.consensus.blockReward;
      const stakeWeight = validator.stake / this.minStake;
      const reputationWeight = validator.reputation / 100;

      const totalReward = Math.floor(baseReward * stakeWeight * reputationWeight);
      rewards.set(address, totalReward);
    }

    return rewards;
  }

  async distributeRewards(epoch) {
    const rewards = this.calculateValidatorRewards(epoch);

    for (const [address, amount] of rewards.entries()) {
      await this.blockchain.distributeValidatorReward(address, amount);
    }

    this.epochBlocks.delete(epoch);
    this.currentEpoch++;
  }
}

module.exports = ConsensusManager;
