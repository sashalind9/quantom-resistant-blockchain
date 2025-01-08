const ContractEngine = require("../../src/contracts/ContractEngine");
const { KyberUtils } = require("../../src/crypto/KyberUtils");

describe("ContractEngine", () => {
  let contractEngine;
  let mockBlockchain;
  let ownerKeyPair;
  let callerKeyPair;

  beforeEach(async () => {
    mockBlockchain = {};
    contractEngine = new ContractEngine(mockBlockchain);
    ownerKeyPair = await KyberUtils.generateKeyPair();
    callerKeyPair = await KyberUtils.generateKeyPair();
  });

  describe("Contract Deployment", () => {
    it("should deploy a valid contract", async () => {
      const code = `
                function add(params) {
                    state.value = (state.value || 0) + params.amount;
                    return state.value;
                }
            `;
      const initialState = { value: 0 };
      const codeHash = blake3.hash(code).toString("hex");
      const signature = await KyberUtils.generateSignature(Buffer.from(codeHash), ownerKeyPair.privateKey);

      const contractAddress = await contractEngine.deployContract(
        code,
        initialState,
        ownerKeyPair.publicKey,
        signature
      );

      expect(contractAddress).toBeDefined();
      const contract = contractEngine.getContract(contractAddress);
      expect(contract.owner).toBe(ownerKeyPair.publicKey);
      expect(contract.code).toBe(code);
    });

    it("should reject contract with invalid signature", async () => {
      const code = "function add(params) { return params.a + params.b; }";
      const initialState = {};
      const invalidSignature = await KyberUtils.generateSignature(
        Buffer.from("wrong-data"),
        ownerKeyPair.privateKey
      );

      await expect(
        contractEngine.deployContract(code, initialState, ownerKeyPair.publicKey, invalidSignature)
      ).rejects.toThrow("Invalid contract deployment signature");
    });

    it("should reject unsafe contract code", async () => {
      const unsafeCode = 'function hack() { eval("malicious code"); }';
      const initialState = {};
      const codeHash = blake3.hash(unsafeCode).toString("hex");
      const signature = await KyberUtils.generateSignature(Buffer.from(codeHash), ownerKeyPair.privateKey);

      await expect(
        contractEngine.deployContract(unsafeCode, initialState, ownerKeyPair.publicKey, signature)
      ).rejects.toThrow("Contract contains prohibited operations");
    });
  });

  describe("Contract Execution", () => {
    let contractAddress;

    beforeEach(async () => {
      const code = `
                function add(params) {
                    state.value = (state.value || 0) + params.amount;
                    return state.value;
                }
            `;
      const initialState = { value: 0 };
      const codeHash = blake3.hash(code).toString("hex");
      const signature = await KyberUtils.generateSignature(Buffer.from(codeHash), ownerKeyPair.privateKey);

      contractAddress = await contractEngine.deployContract(code, initialState, ownerKeyPair.publicKey, signature);
    });

    it("should execute contract method successfully", async () => {
      const params = { amount: 5 };
      const callData = contractEngine.encodeCallData(contractAddress, "add", params);
      const signature = await KyberUtils.generateSignature(Buffer.from(callData), callerKeyPair.privateKey);

      const result = await contractEngine.executeContract(
        contractAddress,
        "add",
        params,
        callerKeyPair.publicKey,
        signature
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe(5);
      expect(result.gasUsed).toBeGreaterThan(0);
    });

    it("should maintain contract state between calls", async () => {
      const params1 = { amount: 5 };
      const params2 = { amount: 3 };

      const callData1 = contractEngine.encodeCallData(contractAddress, "add", params1);
      const signature1 = await KyberUtils.generateSignature(Buffer.from(callData1), callerKeyPair.privateKey);

      const callData2 = contractEngine.encodeCallData(contractAddress, "add", params2);
      const signature2 = await KyberUtils.generateSignature(Buffer.from(callData2), callerKeyPair.privateKey);

      await contractEngine.executeContract(contractAddress, "add", params1, callerKeyPair.publicKey, signature1);

      const result = await contractEngine.executeContract(
        contractAddress,
        "add",
        params2,
        callerKeyPair.publicKey,
        signature2
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe(8);
    });

    it("should reject execution with invalid signature", async () => {
      const params = { amount: 5 };
      const invalidSignature = await KyberUtils.generateSignature(
        Buffer.from("wrong-data"),
        callerKeyPair.privateKey
      );

      await expect(
        contractEngine.executeContract(contractAddress, "add", params, callerKeyPair.publicKey, invalidSignature)
      ).rejects.toThrow("Invalid contract call signature");
    });
  });

  describe("Contract Upgrade", () => {
    let contractAddress;

    beforeEach(async () => {
      const code = `
                function add(params) {
                    state.value = (state.value || 0) + params.amount;
                    return state.value;
                }
            `;
      const initialState = { value: 0 };
      const codeHash = blake3.hash(code).toString("hex");
      const signature = await KyberUtils.generateSignature(Buffer.from(codeHash), ownerKeyPair.privateKey);

      contractAddress = await contractEngine.deployContract(code, initialState, ownerKeyPair.publicKey, signature);
    });

    it("should upgrade contract code successfully", async () => {
      const newCode = `
                function add(params) {
                    state.value = (state.value || 0) + params.amount * 2;
                    return state.value;
                }
            `;

      const upgradeData = `${contractAddress}${newCode}`;
      const signature = await KyberUtils.generateSignature(Buffer.from(upgradeData), ownerKeyPair.privateKey);

      const success = await contractEngine.upgradeContract(contractAddress, newCode, signature);

      expect(success).toBe(true);
      const contract = contractEngine.getContract(contractAddress);
      expect(contract.code).toBe(newCode);
    });

    it("should reject upgrade with invalid owner signature", async () => {
      const newCode = `
                function add(params) {
                    state.value = (state.value || 0) + params.amount * 2;
                    return state.value;
                }
            `;

      const invalidSignature = await KyberUtils.generateSignature(
        Buffer.from("wrong-data"),
        callerKeyPair.privateKey // Not the owner
      );

      await expect(contractEngine.upgradeContract(contractAddress, newCode, invalidSignature)).rejects.toThrow(
        "Invalid upgrade signature"
      );
    });
  });

  describe("Contract History and State", () => {
    let contractAddress;

    beforeEach(async () => {
      const code = `
                function add(params) {
                    state.value = (state.value || 0) + params.amount;
                    return state.value;
                }
            `;
      const initialState = { value: 0 };
      const codeHash = blake3.hash(code).toString("hex");
      const signature = await KyberUtils.generateSignature(Buffer.from(codeHash), ownerKeyPair.privateKey);

      contractAddress = await contractEngine.deployContract(code, initialState, ownerKeyPair.publicKey, signature);
    });

    it("should track contract execution history", async () => {
      const params = { amount: 5 };
      const callData = contractEngine.encodeCallData(contractAddress, "add", params);
      const signature = await KyberUtils.generateSignature(Buffer.from(callData), callerKeyPair.privateKey);

      await contractEngine.executeContract(contractAddress, "add", params, callerKeyPair.publicKey, signature);

      const history = contractEngine.getContractHistory(contractAddress);
      expect(history.totalExecutions).toBe(1);
      expect(history.lastExecuted).toBeDefined();
    });

    it("should maintain contract state correctly", async () => {
      const params = { amount: 5 };
      const callData = contractEngine.encodeCallData(contractAddress, "add", params);
      const signature = await KyberUtils.generateSignature(Buffer.from(callData), callerKeyPair.privateKey);

      await contractEngine.executeContract(contractAddress, "add", params, callerKeyPair.publicKey, signature);

      const state = contractEngine.getContractState(contractAddress);
      expect(state.value).toBe(5);
    });
  });
});
