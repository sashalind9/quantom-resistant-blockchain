const path = require("path");

const config = {
  // Network configuration
  network: {
    mainnet: {
      name: "mainnet",
      networkId: 1,
      port: 3000,
      p2pPort: 6001,
      bootstrapNodes: [
        "ws://node1.quantum-blockchain.network:6001",
        "ws://node2.quantum-blockchain.network:6001",
        "ws://node3.quantum-blockchain.network:6001",
      ],
    },
    testnet: {
      name: "testnet",
      networkId: 2,
      port: 3001,
      p2pPort: 6002,
      bootstrapNodes: [
        "ws://testnet1.quantum-blockchain.network:6001",
        "ws://testnet2.quantum-blockchain.network:6001",
      ],
    },
  },

  // Blockchain parameters
  blockchain: {
    genesisTimestamp: 1683900000000,
    blockTime: 10000, // 10 seconds
    maxBlockSize: 1000000, // 1MB
    maxTransactionsPerBlock: 2000,
    difficultyAdjustmentInterval: 10, // blocks
    targetBlockTime: 10000, // 10 seconds
    initialDifficulty: 4,
    minDifficulty: 4,
    maxDifficulty: 24,
  },

  // Cryptographic parameters
  crypto: {
    kyberSecurityLevel: 3, // Kyber-1024
    hashAlgorithm: "blake3",
    keyLength: 32,
    signatureScheme: "kyber",
  },

  // Consensus parameters
  consensus: {
    minValidators: 4,
    maxValidators: 100,
    validatorStake: 1000000, // Minimum stake required to be a validator
    blockReward: 50,
    halvingInterval: 210000, // blocks
    maxRewardAge: 100, // Maximum number of blocks to claim rewards
  },

  // P2P network parameters
  p2p: {
    maxPeers: 50,
    connectionTimeout: 5000,
    pingInterval: 30000,
    maxMessageSize: 5000000, // 5MB
    handshakeTimeout: 5000,
    banTime: 86400000, // 24 hours
  },

  // Mempool configuration
  mempool: {
    maxSize: 5000,
    maxTransactionAge: 3600000, // 1 hour
    minFeePerByte: 0.00001,
    maxTransactionSize: 100000, // 100KB
  },

  // Storage configuration
  storage: {
    dbPath: path.join(process.cwd(), ".blockchain"),
    maxBatchSize: 1000,
    cacheSize: 100 * 1024 * 1024, // 100MB
    compression: true,
    backupInterval: 86400000, // 24 hours
  },

  // API configuration
  api: {
    rateLimitWindow: 900000, // 15 minutes
    maxRequestsPerWindow: 1000,
    timeout: 30000,
    corsOrigins: ["*"],
    maxPageSize: 100,
  },

  // Wallet configuration
  wallet: {
    addressVersion: 0x00,
    addressChecksumLen: 4,
    minConfirmations: 6,
    dustThreshold: 0.00001,
  },

  // Logging configuration
  logging: {
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
    file: {
      enabled: true,
      path: "logs",
      maxSize: "10m",
      maxFiles: 5,
    },
    console: {
      enabled: true,
      colors: true,
    },
  },

  // Development configuration
  development: {
    debug: process.env.NODE_ENV !== "production",
    testMode: false,
    mockValidators: false,
    artificialLatency: 0,
  },
};

// Environment-specific overrides
if (process.env.NODE_ENV === "test") {
  config.blockchain.blockTime = 1000;
  config.blockchain.targetBlockTime = 1000;
  config.storage.dbPath = path.join(process.cwd(), ".blockchain-test");
  config.p2p.pingInterval = 5000;
  config.development.testMode = true;
}

// Export configuration
module.exports = Object.freeze(config);