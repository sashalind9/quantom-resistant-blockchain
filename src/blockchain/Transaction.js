const { blake3 } = require("blake3");
const { KyberUtils } = require("../crypto/KyberUtils");

class Transaction {
  constructor({
    sender,
    recipient,
    amount,
    timestamp = Date.now(),
    data = "",
    senderPublicKey,
    signature = null,
    nonce = 0,
  }) {
    this.sender = sender;
    this.recipient = recipient;
    this.amount = amount;
    this.timestamp = timestamp;
    this.data = data;
    this.senderPublicKey = senderPublicKey;
    this.signature = signature;
    this.nonce = nonce;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    const data = `${this.sender}${this.recipient}${this.amount}${this.timestamp}${this.data}${this.nonce}`;
    return blake3.hash(data).toString("hex");
  }

  async sign(privateKey) {
    if (!this.senderPublicKey) {
      throw new Error("Transaction must have sender public key before signing");
    }

    try {
      this.signature = await KyberUtils.generateSignature(Buffer.from(this.hash, "hex"), privateKey);
      return true;
    } catch (error) {
      console.error("Transaction signing failed:", error);
      return false;
    }
  }

  async verify() {
    if (!this.signature || !this.senderPublicKey) {
      return false;
    }

    try {
      return await KyberUtils.verifySignature(Buffer.from(this.hash, "hex"), this.signature, this.senderPublicKey);
    } catch (error) {
      console.error("Transaction verification failed:", error);
      return false;
    }
  }

  static createCoinbase(recipientAddress, blockHeight) {
    const reward = this.calculateBlockReward(blockHeight);
    return new Transaction({
      sender: "0000000000000000000000000000000000000000",
      recipient: recipientAddress,
      amount: reward,
      data: `Coinbase reward for block ${blockHeight}`,
      senderPublicKey: "0000000000000000000000000000000000000000",
    });
  }

  static calculateBlockReward(blockHeight) {
    const initialReward = 50;
    const halvingInterval = 210000;
    const halvings = Math.floor(blockHeight / halvingInterval);
    return initialReward / Math.pow(2, halvings);
  }

  isValid() {
    if (this.hash !== this.calculateHash()) {
      return false;
    }

    if (this.amount <= 0) {
      return false;
    }

    if (this.sender === this.recipient) {
      return false;
    }

    // Coinbase transaction validation
    if (this.sender === "0000000000000000000000000000000000000000") {
      return this.amount === Transaction.calculateBlockReward(this.blockHeight);
    }

    return this.verify();
  }

  toJSON() {
    return {
      sender: this.sender,
      recipient: this.recipient,
      amount: this.amount,
      timestamp: this.timestamp,
      data: this.data,
      senderPublicKey: this.senderPublicKey,
      signature: this.signature,
      nonce: this.nonce,
      hash: this.hash,
    };
  }

  static fromJSON(json) {
    return new Transaction(json);
  }

  equals(other) {
    return this.hash === other.hash;
  }

  getSize() {
    return Buffer.from(JSON.stringify(this.toJSON())).length;
  }
}

module.exports = Transaction;
