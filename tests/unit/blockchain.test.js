const Blockchain = require("../../src/blockchain/Blockchain");
const Block = require("../../src/blockchain/Block");
const Transaction = require("../../src/blockchain/Transaction");
const { KyberUtils } = require("../../src/crypto/KyberUtils");

describe("Blockchain", () => {
  let blockchain;
  let senderKeyPair;
  let recipientKeyPair;

  beforeEach(async () => {
    blockchain = new Blockchain();
    await blockchain.initialize();
    senderKeyPair = await KyberUtils.generateKeyPair();
    recipientKeyPair = await KyberUtils.generateKeyPair();
  });

  describe("Genesis block", () => {
    it("should create a valid genesis block", () => {
      const genesisBlock = blockchain.chain[0];
      expect(genesisBlock).toBeDefined();
      expect(genesisBlock.lastHash).toBe("-----");
      expect(genesisBlock.transactions).toHaveLength(0);
    });
  });

  describe("Block addition", () => {
    it("should add a valid block to the chain", async () => {
      const transaction = new Transaction({
        sender: senderKeyPair.publicKey,
        recipient: recipientKeyPair.publicKey,
        amount: 50,
        senderPublicKey: senderKeyPair.publicKey,
      });

      await transaction.sign(senderKeyPair.privateKey);
      const newBlock = await blockchain.addBlock([transaction]);

      expect(blockchain.chain).toHaveLength(2);
      expect(blockchain.chain[1]).toBe(newBlock);
      expect(newBlock.lastHash).toBe(blockchain.chain[0].hash);
    });

    it("should reject invalid blocks", async () => {
      const invalidBlock = new Block({
        lastHash: "invalid",
        hash: "invalid",
        transactions: [],
      });

      await expect(blockchain.addBlock(invalidBlock)).rejects.toThrow("Invalid block");
    });
  });

  describe("Chain validation", () => {
    it("should validate a valid chain", async () => {
      const transaction = new Transaction({
        sender: senderKeyPair.publicKey,
        recipient: recipientKeyPair.publicKey,
        amount: 50,
        senderPublicKey: senderKeyPair.publicKey,
      });

      await transaction.sign(senderKeyPair.privateKey);
      await blockchain.addBlock([transaction]);

      expect(blockchain.isValidChain(blockchain.chain)).toBe(true);
    });

    it("should reject a chain with invalid genesis block", () => {
      blockchain.chain[0] = new Block({
        timestamp: Date.now(),
        lastHash: "fake-last-hash",
        hash: "fake-hash",
        transactions: [],
      });

      expect(blockchain.isValidChain(blockchain.chain)).toBe(false);
    });

    it("should reject a chain with invalid block references", async () => {
      const transaction = new Transaction({
        sender: senderKeyPair.publicKey,
        recipient: recipientKeyPair.publicKey,
        amount: 50,
        senderPublicKey: senderKeyPair.publicKey,
      });

      await transaction.sign(senderKeyPair.privateKey);
      await blockchain.addBlock([transaction]);

      blockchain.chain[1].lastHash = "invalid-reference";
      expect(blockchain.isValidChain(blockchain.chain)).toBe(false);
    });
  });

  describe("Transaction validation", () => {
    it("should validate valid transactions", async () => {
      const transaction = new Transaction({
        sender: senderKeyPair.publicKey,
        recipient: recipientKeyPair.publicKey,
        amount: 50,
        senderPublicKey: senderKeyPair.publicKey,
      });

      await transaction.sign(senderKeyPair.privateKey);
      expect(await transaction.verify()).toBe(true);
    });

    it("should reject transactions with invalid signatures", async () => {
      const transaction = new Transaction({
        sender: senderKeyPair.publicKey,
        recipient: recipientKeyPair.publicKey,
        amount: 50,
        senderPublicKey: senderKeyPair.publicKey,
      });

      // Sign with wrong private key
      await transaction.sign(recipientKeyPair.privateKey);
      expect(await transaction.verify()).toBe(false);
    });
  });

  describe("Quantum resistance", () => {
    it("should generate and verify quantum-resistant signatures", async () => {
      const message = Buffer.from("test message");
      const signature = await KyberUtils.generateSignature(message, senderKeyPair.privateKey);

      const isValid = await KyberUtils.verifySignature(message, signature, senderKeyPair.publicKey);

      expect(isValid).toBe(true);
    });

    it("should reject invalid quantum signatures", async () => {
      const message = Buffer.from("test message");
      const signature = await KyberUtils.generateSignature(message, senderKeyPair.privateKey);

      const differentMessage = Buffer.from("different message");
      const isValid = await KyberUtils.verifySignature(differentMessage, signature, senderKeyPair.publicKey);

      expect(isValid).toBe(false);
    });
  });

  describe("Chain replacement", () => {
    it("should replace the chain with a valid longer chain", async () => {
      const newChain = new Blockchain();
      await newChain.initialize();

      const transaction = new Transaction({
        sender: senderKeyPair.publicKey,
        recipient: recipientKeyPair.publicKey,
        amount: 50,
        senderPublicKey: senderKeyPair.publicKey,
      });

      await transaction.sign(senderKeyPair.privateKey);
      await newChain.addBlock([transaction]);
      await newChain.addBlock([transaction]);

      await blockchain.replaceChain(newChain.chain);
      expect(blockchain.chain).toHaveLength(3);
      expect(blockchain.chain).toEqual(newChain.chain);
    });

    it("should reject shorter chains", async () => {
      const newChain = new Blockchain();
      await newChain.initialize();

      await expect(blockchain.replaceChain(newChain.chain)).rejects.toThrow(
        "Received chain is not longer than current chain"
      );
    });

    it("should reject invalid chains", async () => {
      const newChain = new Blockchain();
      await newChain.initialize();

      const transaction = new Transaction({
        sender: senderKeyPair.publicKey,
        recipient: recipientKeyPair.publicKey,
        amount: 50,
        senderPublicKey: senderKeyPair.publicKey,
      });

      await transaction.sign(senderKeyPair.privateKey);
      await newChain.addBlock([transaction]);
      await newChain.addBlock([transaction]);

      // Corrupt the chain
      newChain.chain[1].hash = "invalid-hash";

      await expect(blockchain.replaceChain(newChain.chain)).rejects.toThrow("Received chain is invalid");
    });
  });
});
