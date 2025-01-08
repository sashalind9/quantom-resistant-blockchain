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

  // Sharding parameters
  sharding: {
    enabled: true,
    totalShards: 16,
    minShardsActive: 4,
    maxShardsPerValidator: 2,
    minValidatorsPerShard: 4,
    maxValidatorsPerShard: 100,
    shardRotationInterval: 10000, // blocks
    crossShardTimeout: 300000, // 5 minutes
    maxCrossShardTxPerBlock: 100,
    minCrossShardConfirmations: 12,
    shardSyncInterval: 1000, // 1 second
    maxShardSize: 1000000000000, // 1TB
    shardRebalanceThreshold: 0.2, // 20% size difference
    maxShardRebalanceSize: 100000000, // 100MB per rebalance
    crossShardCommitteSize: 10,
    shardConsensusThreshold: 0.67, // 67% agreement needed
    maxShardBlockSize: 500000, // 500KB
    maxShardTransactionsPerBlock: 1000,
    shardBlockTime: 5000, // 5 seconds
    crossShardVerificationLevels: 3,
    shardStateVerificationInterval: 100, // blocks
    maxPendingCrossShardTx: 10000,
    shardGossipInterval: 1000, // 1 second
    maxShardGossipBatch: 1000,
    shardMetricsInterval: 60000, // 1 minute
    defaultGasLimitPerShard: 10000000,
    crossShardGasMultiplier: 2,
    shardValidatorReward: 25, // per block
    crossShardValidatorReward: 10, // per transaction
    shardDataRetentionPeriod: 2592000000, // 30 days
    maxShardChainReorg: 100, // blocks
    shardP2PProtocolVersion: 1,
    shardConsensusProtocolVersion: 1,
    shardStorageFormat: "leveldb",
    shardBackupInterval: 86400, // 1 day in blocks
    maxShardBackupSize: 1000000000, // 1GB
    crossShardMessageFormat: "protobuf",
    shardValidatorUpdateInterval: 100, // blocks
    maxShardValidatorInactivity: 86400, // 1 day in blocks
  },

  // Smart Contract parameters
  contracts: {
    maxCodeSize: 500000, // 500KB
    maxGasLimit: 10000000,
    executionTimeout: 5000, // 5 seconds
    maxStateSize: 1000000, // 1MB
    maxContractsPerBlock: 50,
    maxCallDataSize: 100000, // 100KB
    minGasPrice: 0.00001,
    maxStackDepth: 1024,
    maxMemoryUsage: 100 * 1024 * 1024, // 100MB
    maxContractCalls: 100, // Per transaction
    upgradeGracePeriod: 86400000, // 24 hours
    contractAuditRequired: true,
    allowedContractLanguages: ["javascript"],
    prohibitedOperations: ["eval", "Function", "require", "process", "__proto__", "constructor["],
    defaultGasCosts: {
      base: 21000,
      dataWrite: 20000,
      dataRead: 5000,
      computation: 1,
      memory: 1,
      storage: 100,
    },
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
  config.contracts.executionTimeout = 1000;
  config.contracts.maxGasLimit = 1000000;
  config.sharding.totalShards = 4;
  config.sharding.minValidatorsPerShard = 2;
  config.sharding.shardBlockTime = 1000;
  config.sharding.crossShardTimeout = 30000;
}

// Export configuration
module.exports = Object.freeze(config);
