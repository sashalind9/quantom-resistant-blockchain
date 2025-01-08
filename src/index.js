const Blockchain = require("./blockchain/Blockchain");
const P2PServer = require("./network/P2PServer");
const APIServer = require("./api/APIServer");
const { Mempool } = require("./mempool/Mempool");
// const { LevelDB } = require("./storage/LevelDB");
const winston = require("winston");

// Configure logging
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  ],
});

// Environment variables
const API_PORT = process.env.API_PORT || 3000;
const P2P_PORT = process.env.P2P_PORT || 6001;
const INITIAL_PEERS = process.env.INITIAL_PEERS ? process.env.INITIAL_PEERS.split(",") : [];

async function main() {
  try {
    logger.info("Initializing Quantum-Resistant Blockchain Node...");

    // Initialize blockchain
    const blockchain = new Blockchain();
    await blockchain.initialize();
    logger.info("Blockchain initialized");

    // Initialize mempool
    const mempool = new Mempool();
    logger.info("Mempool initialized");

    // Initialize P2P server
    const p2pServer = new P2PServer(blockchain, mempool);
    await p2pServer.initialize(P2P_PORT);
    logger.info(`P2P Server listening on port ${P2P_PORT}`);

    // Connect to initial peers
    for (const peer of INITIAL_PEERS) {
      await p2pServer.connectToPeer(peer);
    }
    logger.info(`Connected to ${INITIAL_PEERS.length} initial peers`);

    // Initialize API server
    const apiServer = new APIServer(blockchain, p2pServer, mempool);
    await apiServer.start(API_PORT);
    logger.info(`API Server listening on port ${API_PORT}`);

    // Handle shutdown
    process.on("SIGINT", async () => {
      logger.info("Shutting down node...");
      await blockchain.db.close();
      process.exit(0);
    });

    // Log node information
    logger.info("Node successfully started", {
      apiPort: API_PORT,
      p2pPort: P2P_PORT,
      initialPeers: INITIAL_PEERS,
      blockHeight: blockchain.getBlockHeight(),
      nodePublicKey: blockchain.getPublicKey(),
    });
  } catch (error) {
    logger.error("Failed to start node:", error);
    process.exit(1);
  }
}

// Start the application
main().catch((error) => {
  logger.error("Unhandled error:", error);
  process.exit(1);
});
