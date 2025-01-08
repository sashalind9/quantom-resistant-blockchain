const ConsensusManager = require("../../src/consensus/ConsensusManager");
const { KyberUtils } = require("../../src/crypto/KyberUtils");
const Block = require("../../src/blockchain/Block");

describe("ConsensusManager", () => {
  let consensusManager;
  let mockBlockchain;
  let validatorKeyPair;

  beforeEach(async () => {
    mockBlockchain = {
      distributeValidatorReward: jest.fn(),
    };
    consensusManager = new ConsensusManager(mockBlockchain);
    validatorKeyPair = await KyberUtils.generateKeyPair();
  });

  describe("Validator Registration", () => {
    it("should register a new validator successfully", async () => {
      const validatorInfo = await consensusManager.registerValidator(
        "validator-address",
        1000000,
        validatorKeyPair.publicKey
      );

      expect(validatorInfo).toBeDefined();
      expect(validatorInfo.address).toBe("validator-address");
      expect(validatorInfo.stake).toBe(1000000);
      expect(validatorInfo.publicKey).toBe(validatorKeyPair.publicKey);
      expect(validatorInfo.reputation).toBe(100);
    });

    it("should reject registration with insufficient stake", async () => {
      await expect(
        consensusManager.registerValidator("validator-address", 100, validatorKeyPair.publicKey)
      ).rejects.toThrow("Minimum stake requirement not met");
    });

    it("should reject duplicate validator registration", async () => {
      await consensusManager.registerValidator("validator-address", 1000000, validatorKeyPair.publicKey);

      await expect(
        consensusManager.registerValidator("validator-address", 1000000, validatorKeyPair.publicKey)
      ).rejects.toThrow("Validator already registered");
    });
  });

  describe("Validator Selection", () => {
    beforeEach(async () => {
      // Register multiple validators
      for (let i = 0; i < 5; i++) {
        const keyPair = await KyberUtils.generateKeyPair();
        await consensusManager.registerValidator(`validator-${i}`, 1000000 + i * 100000, keyPair.publicKey);
      }
    });

    it("should select a validator based on stake weight", async () => {
      const validator = await consensusManager.selectNextValidator();
      expect(validator).toBeDefined();
      expect(validator.stake).toBeGreaterThanOrEqual(1000000);
    });

    it("should only select from active validators", async () => {
      // Make all validators inactive except one
      const validators = consensusManager.getAllValidators();
      for (const validator of validators) {
        validator.lastActive = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
        validator.reputation = 0;
      }
      validators[0].lastActive = Date.now();
      validators[0].reputation = 100;

      const selectedValidator = await consensusManager.selectNextValidator();
      expect(selectedValidator).toBe(validators[0]);
    });
  });

  describe("Block Validation", () => {
    let validator;
    let block;

    beforeEach(async () => {
      validator = await consensusManager.registerValidator(
        "validator-address",
        1000000,
        validatorKeyPair.publicKey
      );

      block = new Block({
        timestamp: Date.now(),
        lastHash: "previous-hash",
        hash: "current-hash",
        transactions: [],
        nonce: 0,
        difficulty: 4,
        quantumProof: await KyberUtils.generateBlockProof("current-hash", validatorKeyPair),
      });
    });

    it("should validate a correctly signed block", async () => {
      const isValid = await consensusManager.validateBlock(block, validator);
      expect(isValid).toBe(true);
    });

    it("should reject a block with invalid signature", async () => {
      const differentKeyPair = await KyberUtils.generateKeyPair();
      block.quantumProof = await KyberUtils.generateBlockProof("current-hash", differentKeyPair);

      const isValid = await consensusManager.validateBlock(block, validator);
      expect(isValid).toBe(false);
    });

    it("should reject a block from an inactive validator", async () => {
      validator.lastActive = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
      validator.reputation = 0;

      const isValid = await consensusManager.validateBlock(block, validator);
      expect(isValid).toBe(false);
    });
  });

  describe("Reward Distribution", () => {
    beforeEach(async () => {
      // Register validators and simulate block production
      for (let i = 0; i < 3; i++) {
        const keyPair = await KyberUtils.generateKeyPair();
        await consensusManager.registerValidator(`validator-${i}`, 1000000, keyPair.publicKey);
      }

      consensusManager.epochBlocks.set(
        0,
        new Map([
          ["validator-0", Array(10)], // 10 blocks
          ["validator-1", Array(5)], // 5 blocks
          ["validator-2", Array(3)], // 3 blocks
        ])
      );
    });

    it("should calculate rewards correctly", () => {
      const rewards = consensusManager.calculateValidatorRewards(0);
      expect(rewards.get("validator-0")).toBeGreaterThan(rewards.get("validator-1"));
      expect(rewards.get("validator-1")).toBeGreaterThan(rewards.get("validator-2"));
    });

    it("should distribute rewards and advance epoch", async () => {
      await consensusManager.distributeRewards(0);

      expect(mockBlockchain.distributeValidatorReward).toHaveBeenCalled();
      expect(consensusManager.currentEpoch).toBe(1);
      expect(consensusManager.epochBlocks.has(0)).toBe(false);
    });
  });
});
