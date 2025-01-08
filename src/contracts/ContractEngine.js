const { KyberUtils } = require("../crypto/KyberUtils");
const { blake3 } = require("blake3");
const config = require("../config/config");

class ContractEngine {
  constructor(blockchain) {
    this.blockchain = blockchain;
    this.contracts = new Map();
    this.contractStates = new Map();
    this.executionQueue = [];
    this.maxGasLimit = config.contracts.maxGasLimit;
  }

  async deployContract(code, initialState, ownerPublicKey, signature) {
    // Verify quantum-resistant signature
    const codeHash = blake3.hash(code).toString("hex");
    const isValid = await KyberUtils.verifySignature(Buffer.from(codeHash), signature, ownerPublicKey);

    if (!isValid) {
      throw new Error("Invalid contract deployment signature");
    }

    // Generate quantum-resistant contract address
    const contractAddress = await this.generateContractAddress(code, ownerPublicKey);

    // Verify code safety
    this.verifyCodeSafety(code);

    // Store contract
    const contract = {
      code,
      owner: ownerPublicKey,
      address: contractAddress,
      createdAt: Date.now(),
      lastExecuted: null,
      totalExecutions: 0,
    };

    this.contracts.set(contractAddress, contract);
    this.contractStates.set(contractAddress, initialState);

    return contractAddress;
  }

  async executeContract(contractAddress, method, params, callerPublicKey, signature) {
    const contract = this.contracts.get(contractAddress);
    if (!contract) {
      throw new Error("Contract not found");
    }

    // Verify quantum-resistant call signature
    const callData = this.encodeCallData(contractAddress, method, params);
    const isValid = await KyberUtils.verifySignature(Buffer.from(callData), signature, callerPublicKey);

    if (!isValid) {
      throw new Error("Invalid contract call signature");
    }

    // Create secure execution environment
    const executionContext = {
      contract,
      state: this.contractStates.get(contractAddress),
      method,
      params,
      caller: callerPublicKey,
      gasUsed: 0,
      logs: [],
    };

    // Execute in isolated environment
    const result = await this.executeInSandbox(executionContext);

    // Update contract state
    if (result.success) {
      this.contractStates.set(contractAddress, result.newState);
      contract.lastExecuted = Date.now();
      contract.totalExecutions++;
      this.contracts.set(contractAddress, contract);
    }

    return {
      success: result.success,
      result: result.value,
      gasUsed: result.gasUsed,
      logs: result.logs,
    };
  }

  async executeInSandbox(context) {
    // Create isolated VM context
    const vm = require("vm");
    const sandbox = {
      state: context.state,
      params: context.params,
      caller: context.caller,
      blake3,
      KyberUtils,
      console: {
        log: (...args) => context.logs.push(args.join(" ")),
      },
    };

    // Prepare contract code
    const wrappedCode = `
            'use strict';
            async function executeContract() {
                try {
                    ${context.contract.code}
                    return await ${context.method}(params);
                } catch (error) {
                    throw new Error('Contract execution failed: ' + error.message);
                }
            }
            executeContract();
        `;

    try {
      // Execute with resource limits
      const script = new vm.Script(wrappedCode);
      const result = await script.runInNewContext(sandbox, {
        timeout: config.contracts.executionTimeout,
        displayErrors: true,
      });

      return {
        success: true,
        value: result,
        newState: sandbox.state,
        gasUsed: this.calculateGasUsed(context),
        logs: context.logs,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        gasUsed: this.calculateGasUsed(context),
        logs: context.logs,
      };
    }
  }

  async generateContractAddress(code, ownerPublicKey) {
    const timestamp = Date.now();
    const data = `${code}${ownerPublicKey}${timestamp}`;
    const hash = blake3.hash(data).toString("hex");

    // Add quantum resistance to address generation
    const quantumProof = await KyberUtils.generateContractAddressProof(hash);
    return blake3.hash(quantumProof).toString("hex");
  }

  verifyCodeSafety(code) {
    // Check for prohibited operations
    const prohibitedPatterns = [
      /eval\s*\(/,
      /Function\s*\(/,
      /require\s*\(/,
      /process\./,
      /\.__proto__/,
      /constructor\s*\[/,
    ];

    for (const pattern of prohibitedPatterns) {
      if (pattern.test(code)) {
        throw new Error("Contract contains prohibited operations");
      }
    }

    // Verify code size
    if (code.length > config.contracts.maxCodeSize) {
      throw new Error("Contract code size exceeds limit");
    }
  }

  calculateGasUsed(context) {
    // Basic gas calculation based on operations
    let gas = 0;

    // Base cost
    gas += 21000;

    // Memory operations
    gas += JSON.stringify(context.state).length * 10;

    // Computation complexity
    gas += context.contract.code.length * 5;

    return Math.min(gas, this.maxGasLimit);
  }

  encodeCallData(contractAddress, method, params) {
    return blake3.hash(`${contractAddress}${method}${JSON.stringify(params)}`).toString("hex");
  }

  getContract(address) {
    return this.contracts.get(address);
  }

  getContractState(address) {
    return this.contractStates.get(address);
  }

  getContractHistory(address) {
    const contract = this.contracts.get(address);
    if (!contract) return null;

    return {
      address,
      owner: contract.owner,
      createdAt: contract.createdAt,
      lastExecuted: contract.lastExecuted,
      totalExecutions: contract.totalExecutions,
    };
  }

  async upgradeContract(address, newCode, ownerSignature) {
    const contract = this.contracts.get(address);
    if (!contract) {
      throw new Error("Contract not found");
    }

    // Verify owner's quantum-resistant signature
    const upgradeData = `${address}${newCode}`;
    const isValid = await KyberUtils.verifySignature(Buffer.from(upgradeData), ownerSignature, contract.owner);

    if (!isValid) {
      throw new Error("Invalid upgrade signature");
    }

    // Verify new code safety
    this.verifyCodeSafety(newCode);

    // Update contract code
    contract.code = newCode;
    contract.lastUpgraded = Date.now();
    this.contracts.set(address, contract);

    return true;
  }
}

module.exports = ContractEngine;
