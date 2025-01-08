const express = require("express");
const bodyParser = require("body-parser");
const { KyberUtils } = require("../crypto/KyberUtils");
const Transaction = require("../blockchain/Transaction");

class APIServer {
  constructor(blockchain, p2pServer, mempool) {
    this.blockchain = blockchain;
    this.p2pServer = p2pServer;
    this.mempool = mempool;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(bodyParser.json());
    this.app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      next();
    });
  }

  setupRoutes() {
    // Blockchain routes
    this.app.get("/blocks", this.getBlocks.bind(this));
    this.app.get("/blocks/:hash", this.getBlockByHash.bind(this));
    this.app.get("/blocks/height/:height", this.getBlockByHeight.bind(this));

    // Transaction routes
    this.app.post("/transactions", this.createTransaction.bind(this));
    this.app.get("/transactions/:hash", this.getTransaction.bind(this));
    this.app.get("/transactions/address/:address", this.getAddressTransactions.bind(this));
    this.app.get("/mempool", this.getMempoolTransactions.bind(this));

    // Wallet routes
    this.app.post("/wallet/create", this.createWallet.bind(this));
    this.app.get("/wallet/:address/balance", this.getBalance.bind(this));

    // Network routes
    this.app.get("/peers", this.getPeers.bind(this));
    this.app.post("/peers", this.addPeer.bind(this));

    // Node info routes
    this.app.get("/info", this.getNodeInfo.bind(this));
  }

  start(port) {
    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => {
        console.log(`API Server running on port ${port}`);
        resolve();
      });
    });
  }

  // Blockchain endpoints
  async getBlocks(req, res) {
    try {
      const { start, limit } = req.query;
      let blocks = this.blockchain.chain;

      if (start && limit) {
        blocks = blocks.slice(parseInt(start), parseInt(start) + parseInt(limit));
      }

      res.json({
        success: true,
        data: blocks,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getBlockByHash(req, res) {
    try {
      const block = await this.blockchain.getBlockByHash(req.params.hash);
      if (!block) {
        return res.status(404).json({
          success: false,
          error: "Block not found",
        });
      }

      res.json({
        success: true,
        data: block,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getBlockByHeight(req, res) {
    try {
      const height = parseInt(req.params.height);
      const block = await this.blockchain.getBlockByHeight(height);

      if (!block) {
        return res.status(404).json({
          success: false,
          error: "Block not found",
        });
      }

      res.json({
        success: true,
        data: block,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // Transaction endpoints
  async createTransaction(req, res) {
    try {
      const { sender, recipient, amount, privateKey } = req.body;

      if (!sender || !recipient || !amount || !privateKey) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields",
        });
      }

      const transaction = new Transaction({
        sender,
        recipient,
        amount: parseFloat(amount),
        senderPublicKey: await KyberUtils.getPublicKeyFromPrivate(privateKey),
      });

      await transaction.sign(privateKey);

      if (await transaction.verify()) {
        this.mempool.addTransaction(transaction);
        this.p2pServer.broadcastTransaction(transaction);

        res.json({
          success: true,
          data: transaction,
        });
      } else {
        res.status(400).json({
          success: false,
          error: "Invalid transaction signature",
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getTransaction(req, res) {
    try {
      const transaction = await this.blockchain.db.getTransaction(req.params.hash);

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: "Transaction not found",
        });
      }

      res.json({
        success: true,
        data: transaction,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getAddressTransactions(req, res) {
    try {
      const transactions = await this.blockchain.db.getAddressTransactions(req.params.address);

      res.json({
        success: true,
        data: transactions,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getMempoolTransactions(req, res) {
    try {
      const transactions = this.mempool.getMempoolTransactions();

      res.json({
        success: true,
        data: transactions,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // Wallet endpoints
  async createWallet(req, res) {
    try {
      const keyPair = await KyberUtils.generateKeyPair();

      res.json({
        success: true,
        data: {
          publicKey: keyPair.publicKey,
          privateKey: keyPair.privateKey,
          address: KyberUtils.publicKeyToAddress(keyPair.publicKey),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getBalance(req, res) {
    try {
      const balance = await this.blockchain.getBalance(req.params.address);

      res.json({
        success: true,
        data: {
          address: req.params.address,
          balance,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // Network endpoints
  getPeers(req, res) {
    try {
      const peers = this.p2pServer.getPeers();

      res.json({
        success: true,
        data: {
          count: peers.length,
          peers,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async addPeer(req, res) {
    try {
      const { peerAddress } = req.body;

      if (!peerAddress) {
        return res.status(400).json({
          success: false,
          error: "Missing peer address",
        });
      }

      await this.p2pServer.connectToPeer(peerAddress);

      res.json({
        success: true,
        message: "Peer added successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // Node info endpoint
  getNodeInfo(req, res) {
    try {
      res.json({
        success: true,
        data: {
          version: "1.0.0",
          blockHeight: this.blockchain.getBlockHeight(),
          peerCount: this.p2pServer.getPeerCount(),
          mempoolSize: this.mempool.getMempoolTransactions().length,
          isSyncing: false,
          nodePublicKey: this.blockchain.getPublicKey(),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

module.exports = APIServer;
