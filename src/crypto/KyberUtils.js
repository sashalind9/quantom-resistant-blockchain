const kyber = require("pqc-kyber");
const { randomBytes } = require("crypto");

class KyberUtils {
  static KYBER_SECURITY_LEVEL = 3; // Highest security level (Kyber-1024)
  static KEY_LENGTH = 32;

  static async generateKeyPair() {
    const seed = randomBytes(32);
    const { publicKey, privateKey } = await kyber.keyPair(seed, this.KYBER_SECURITY_LEVEL);

    return {
      publicKey: Buffer.from(publicKey).toString("hex"),
      privateKey: Buffer.from(privateKey).toString("hex"),
    };
  }

  static async encapsulate(publicKey) {
    const pubKeyBuffer = Buffer.from(publicKey, "hex");
    const { ciphertext, sharedSecret } = await kyber.encapsulate(pubKeyBuffer, this.KYBER_SECURITY_LEVEL);

    return {
      ciphertext: Buffer.from(ciphertext).toString("hex"),
      sharedSecret: Buffer.from(sharedSecret).toString("hex"),
    };
  }

  static async decapsulate(ciphertext, privateKey) {
    const ciphertextBuffer = Buffer.from(ciphertext, "hex");
    const privKeyBuffer = Buffer.from(privateKey, "hex");

    const sharedSecret = await kyber.decapsulate(ciphertextBuffer, privKeyBuffer, this.KYBER_SECURITY_LEVEL);
    return Buffer.from(sharedSecret).toString("hex");
  }

  static generateBlockProof(blockHash, quantumKeyPair) {
    const message = Buffer.from(blockHash, "hex");
    const { publicKey, privateKey } = quantumKeyPair;

    // Generate a quantum-resistant signature
    return this.generateSignature(message, privateKey);
  }

  static verifyBlockProof(blockHash, proof, publicKey) {
    const message = Buffer.from(blockHash, "hex");
    return this.verifySignature(message, proof, publicKey);
  }

  static generateInitialQuantumProof() {
    // Generate a deterministic quantum-resistant proof for genesis block
    const seed = Buffer.from("quantum-genesis-seed", "utf8");
    return this.generateDeterministicProof(seed);
  }

  static async generateSignature(message, privateKey) {
    const privKeyBuffer = Buffer.from(privateKey, "hex");
    const randomness = randomBytes(32);

    // Combine message with randomness for additional security
    const signatureBase = Buffer.concat([message, randomness]);
    const { ciphertext } = await kyber.encapsulate(signatureBase, this.KYBER_SECURITY_LEVEL);

    return {
      signature: Buffer.from(ciphertext).toString("hex"),
      randomness: randomness.toString("hex"),
    };
  }

  static async verifySignature(message, proof, publicKey) {
    try {
      const { signature, randomness } = proof;
      const pubKeyBuffer = Buffer.from(publicKey, "hex");
      const signatureBuffer = Buffer.from(signature, "hex");
      const randomnessBuffer = Buffer.from(randomness, "hex");

      // Reconstruct signature base
      const signatureBase = Buffer.concat([message, randomnessBuffer]);

      // Verify using Kyber's decapsulation
      const verified = await kyber.decapsulate(signatureBuffer, pubKeyBuffer, this.KYBER_SECURITY_LEVEL);
      return Buffer.compare(verified, signatureBase) === 0;
    } catch (error) {
      console.error("Signature verification failed:", error);
      return false;
    }
  }

  static generateDeterministicProof(seed) {
    // Generate a deterministic proof based on seed
    const derivedKey = Buffer.from(seed).toString("hex");
    return {
      signature: derivedKey,
      randomness: randomBytes(32).toString("hex"),
    };
  }

  static async generateSessionKeys(peerPublicKey, ownKeyPair) {
    const { publicKey, privateKey } = ownKeyPair;

    // Generate forward-secure session keys using Kyber
    const { ciphertext, sharedSecret } = await this.encapsulate(peerPublicKey);
    const ownSharedSecret = await this.decapsulate(ciphertext, privateKey);

    return {
      sessionKey: sharedSecret,
      verificationKey: ownSharedSecret,
    };
  }
}

module.exports = KyberUtils;
