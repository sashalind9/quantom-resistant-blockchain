const WebSocket = require("socket.io");
const { KyberUtils } = require("../crypto/KyberUtils");

const MESSAGE_TYPES = {
  NEW_BLOCK: "NEW_BLOCK",
  NEW_TRANSACTION: "NEW_TRANSACTION",
  CHAIN_REQUEST: "CHAIN_REQUEST",
  CHAIN_RESPONSE: "CHAIN_RESPONSE",
  PEER_DISCOVERY: "PEER_DISCOVERY",
  PEER_LIST: "PEER_LIST",
  HANDSHAKE: "HANDSHAKE",
  HANDSHAKE_RESPONSE: "HANDSHAKE_RESPONSE",
};

class P2PServer {
  constructor(blockchain, mempool) {
    this.blockchain = blockchain;
    this.mempool = mempool;
    this.sockets = new Map();
    this.peers = new Set();
    this.server = null;
    this.quantumKeyPair = null;
    this.peerSessions = new Map();
  }

  async initialize(port) {
    this.server = new WebSocket.Server({
      port,
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    this.quantumKeyPair = await KyberUtils.generateKeyPair();
    this.setupMessageHandlers();
  }

  setupMessageHandlers() {
    this.server.on("connection", async (socket) => {
      console.log("New peer connected");

      // Initialize quantum-safe session
      await this.initializeSecureSession(socket);

      socket.on("message", async (message) => {
        try {
          const decryptedMessage = await this.decryptMessage(socket.id, message);
          await this.handleMessage(socket, decryptedMessage);
        } catch (error) {
          console.error("Message handling failed:", error);
        }
      });

      socket.on("disconnect", () => {
        this.handleDisconnect(socket);
      });
    });
  }

  async initializeSecureSession(socket) {
    try {
      // Exchange quantum-resistant keys
      const handshakeMessage = {
        type: MESSAGE_TYPES.HANDSHAKE,
        publicKey: this.quantumKeyPair.publicKey,
      };

      socket.emit("message", handshakeMessage);

      // Wait for handshake response
      const response = await new Promise((resolve) => {
        socket.once("message", resolve);
      });

      if (response.type !== MESSAGE_TYPES.HANDSHAKE_RESPONSE) {
        throw new Error("Invalid handshake response");
      }

      // Generate session keys using Kyber
      const sessionKeys = await KyberUtils.generateSessionKeys(response.publicKey, this.quantumKeyPair);

      this.peerSessions.set(socket.id, {
        sessionKey: sessionKeys.sessionKey,
        peerPublicKey: response.publicKey,
      });

      this.sockets.set(socket.id, socket);
      this.peers.add(socket.id);

      // Send initial blockchain state
      await this.syncChain(socket);
    } catch (error) {
      console.error("Secure session initialization failed:", error);
      socket.disconnect();
    }
  }

  async connectToPeer(peerAddress) {
    if (this.peers.has(peerAddress)) {
      console.log("Already connected to peer:", peerAddress);
      return;
    }

    try {
      const socket = new WebSocket(peerAddress);
      await this.initializeSecureSession(socket);
      console.log("Successfully connected to peer:", peerAddress);
    } catch (error) {
      console.error("Failed to connect to peer:", error);
    }
  }

  async handleMessage(socket, message) {
    switch (message.type) {
      case MESSAGE_TYPES.NEW_BLOCK:
        await this.handleNewBlock(message.data);
        break;

      case MESSAGE_TYPES.NEW_TRANSACTION:
        await this.handleNewTransaction(message.data);
        break;

      case MESSAGE_TYPES.CHAIN_REQUEST:
        await this.handleChainRequest(socket);
        break;

      case MESSAGE_TYPES.CHAIN_RESPONSE:
        await this.handleChainResponse(message.data);
        break;

      case MESSAGE_TYPES.PEER_DISCOVERY:
        this.handlePeerDiscovery(socket);
        break;

      case MESSAGE_TYPES.PEER_LIST:
        await this.handlePeerList(message.data);
        break;

      default:
        console.warn("Unknown message type:", message.type);
    }
  }

  async handleNewBlock(block) {
    try {
      const isValid = await this.blockchain.isValidNewBlock(block);
      if (isValid) {
        await this.blockchain.addBlock(block);
        this.broadcastMessage({
          type: MESSAGE_TYPES.NEW_BLOCK,
          data: block,
        });
      }
    } catch (error) {
      console.error("Failed to handle new block:", error);
    }
  }

  async handleNewTransaction(transaction) {
    try {
      const isValid = await transaction.verify();
      if (isValid && this.mempool.addTransaction(transaction)) {
        this.broadcastMessage({
          type: MESSAGE_TYPES.NEW_TRANSACTION,
          data: transaction,
        });
      }
    } catch (error) {
      console.error("Failed to handle new transaction:", error);
    }
  }

  async handleChainRequest(socket) {
    const chain = await this.blockchain.getChain();
    const encryptedResponse = await this.encryptMessage(socket.id, {
      type: MESSAGE_TYPES.CHAIN_RESPONSE,
      data: chain,
    });
    socket.emit("message", encryptedResponse);
  }

  async handleChainResponse(chain) {
    try {
      if (chain.length > this.blockchain.chain.length) {
        const isValid = this.blockchain.isValidChain(chain);
        if (isValid) {
          await this.blockchain.replaceChain(chain);
        }
      }
    } catch (error) {
      console.error("Failed to handle chain response:", error);
    }
  }

  handlePeerDiscovery(socket) {
    const peerList = Array.from(this.peers);
    socket.emit("message", {
      type: MESSAGE_TYPES.PEER_LIST,
      data: peerList,
    });
  }

  async handlePeerList(peers) {
    for (const peer of peers) {
      if (!this.peers.has(peer)) {
        await this.connectToPeer(peer);
      }
    }
  }

  handleDisconnect(socket) {
    this.sockets.delete(socket.id);
    this.peers.delete(socket.id);
    this.peerSessions.delete(socket.id);
    console.log("Peer disconnected:", socket.id);
  }

  async broadcastMessage(message) {
    const promises = Array.from(this.sockets.entries()).map(async ([socketId, socket]) => {
      try {
        const encryptedMessage = await this.encryptMessage(socketId, message);
        socket.emit("message", encryptedMessage);
      } catch (error) {
        console.error("Failed to broadcast message to peer:", socketId, error);
      }
    });

    await Promise.all(promises);
  }

  async encryptMessage(socketId, message) {
    const session = this.peerSessions.get(socketId);
    if (!session) {
      throw new Error("No secure session established");
    }

    const { ciphertext } = await KyberUtils.encapsulate(
      session.peerPublicKey,
      Buffer.from(JSON.stringify(message))
    );

    return {
      encrypted: true,
      data: ciphertext,
    };
  }

  async decryptMessage(socketId, message) {
    if (!message.encrypted) {
      return message;
    }

    const session = this.peerSessions.get(socketId);
    if (!session) {
      throw new Error("No secure session established");
    }

    const decrypted = await KyberUtils.decapsulate(message.data, this.quantumKeyPair.privateKey);

    return JSON.parse(decrypted);
  }

  async syncChain(socket) {
    const message = {
      type: MESSAGE_TYPES.CHAIN_REQUEST,
    };

    const encryptedMessage = await this.encryptMessage(socket.id, message);
    socket.emit("message", encryptedMessage);
  }

  broadcastTransaction(transaction) {
    this.broadcastMessage({
      type: MESSAGE_TYPES.NEW_TRANSACTION,
      data: transaction,
    });
  }

  broadcastBlock(block) {
    this.broadcastMessage({
      type: MESSAGE_TYPES.NEW_BLOCK,
      data: block,
    });
  }

  getPeerCount() {
    return this.peers.size;
  }

  getPeers() {
    return Array.from(this.peers);
  }
}

module.exports = P2PServer;
