const { Level } = require("level");
const path = require("path");

class LevelDB {
  constructor(location = ".blockchain") {
    this.dbLocation = path.join(process.cwd(), location);
    this.db = new Level(this.dbLocation, {
      valueEncoding: "json",
    });
  }

  async initialize() {
    try {
      await this.db.open();
    } catch (error) {
      console.error("Failed to initialize database:", error);
      throw error;
    }
  }

  async close() {
    await this.db.close();
  }

  async saveBlock(block) {
    const batch = this.db.batch();

    try {
      // Save block by height
      batch.put(`block:height:${block.height}`, block);

      // Save block by hash
      batch.put(`block:hash:${block.hash}`, block);

      // Update block height index
      batch.put("chain:height", block.height);

      // Save transactions
      for (const tx of block.transactions) {
        batch.put(`tx:${tx.hash}`, {
          ...tx,
          blockHash: block.hash,
          blockHeight: block.height,
          timestamp: block.timestamp,
        });
      }

      await batch.write();
    } catch (error) {
      console.error("Failed to save block:", error);
      throw error;
    }
  }

  async saveChain(chain) {
    const batch = this.db.batch();

    try {
      // Clear existing chain
      await this.clearChain();

      // Save all blocks
      for (let height = 0; height < chain.length; height++) {
        const block = chain[height];
        block.height = height;

        batch.put(`block:height:${height}`, block);
        batch.put(`block:hash:${block.hash}`, block);

        // Save transactions
        for (const tx of block.transactions) {
          batch.put(`tx:${tx.hash}`, {
            ...tx,
            blockHash: block.hash,
            blockHeight: height,
            timestamp: block.timestamp,
          });
        }
      }

      // Update chain height
      batch.put("chain:height", chain.length - 1);

      await batch.write();
    } catch (error) {
      console.error("Failed to save chain:", error);
      throw error;
    }
  }

  async getChain() {
    try {
      const height = await this.getChainHeight();
      if (height === -1) return null;

      const chain = [];
      for (let i = 0; i <= height; i++) {
        const block = await this.getBlockByHeight(i);
        if (!block) throw new Error(`Missing block at height ${i}`);
        chain.push(block);
      }

      return chain;
    } catch (error) {
      console.error("Failed to get chain:", error);
      return null;
    }
  }

  async getBlockByHash(hash) {
    try {
      return await this.db.get(`block:hash:${hash}`);
    } catch (error) {
      if (error.notFound) return null;
      throw error;
    }
  }

  async getBlockByHeight(height) {
    try {
      return await this.db.get(`block:height:${height}`);
    } catch (error) {
      if (error.notFound) return null;
      throw error;
    }
  }

  async getTransaction(txHash) {
    try {
      return await this.db.get(`tx:${txHash}`);
    } catch (error) {
      if (error.notFound) return null;
      throw error;
    }
  }

  async getChainHeight() {
    try {
      return await this.db.get("chain:height");
    } catch (error) {
      if (error.notFound) return -1;
      throw error;
    }
  }

  async clearChain() {
    const batch = this.db.batch();

    try {
      // Get all keys
      const keys = [];
      for await (const key of this.db.keys()) {
        keys.push(key);
      }

      // Delete all keys
      for (const key of keys) {
        batch.del(key);
      }

      await batch.write();
    } catch (error) {
      console.error("Failed to clear chain:", error);
      throw error;
    }
  }

  async getAddressTransactions(address) {
    const transactions = [];

    try {
      for await (const [key, value] of this.db.iterator({
        gte: "tx:",
        lte: "tx:\xff",
      })) {
        if (value.sender === address || value.recipient === address) {
          transactions.push(value);
        }
      }
    } catch (error) {
      console.error("Failed to get address transactions:", error);
      throw error;
    }

    return transactions.sort((a, b) => b.timestamp - a.timestamp);
  }

  async createBackup(backupPath) {
    try {
      const backup = this.db.createReadStream();
      const writeStream = require("fs").createWriteStream(backupPath);

      backup.pipe(writeStream);

      return new Promise((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });
    } catch (error) {
      console.error("Failed to create backup:", error);
      throw error;
    }
  }
}

module.exports = LevelDB;
