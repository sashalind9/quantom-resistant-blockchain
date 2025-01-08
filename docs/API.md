# Quantum-Resistant Blockchain API Documentation

## Overview

This document describes the REST API endpoints for interacting with the quantum-resistant blockchain node.

## Base URL

```
http://localhost:3000
```

## Authentication

Currently, the API does not require authentication. However, rate limiting is applied to prevent abuse.

## Endpoints

### Blockchain

#### Get Blocks

Retrieves a list of blocks from the blockchain.

```
GET /blocks
```

Query Parameters:

- `start` (optional): Starting block height
- `limit` (optional): Maximum number of blocks to return

Response:

```json
{
    "success": true,
    "data": [
        {
            "timestamp": 1683900000000,
            "lastHash": "-----",
            "hash": "genesis-hash",
            "transactions": [],
            "nonce": 0,
            "difficulty": 4,
            "quantumProof": {...}
        },
        // ... more blocks
    ]
}
```

#### Get Block by Hash

Retrieves a specific block by its hash.

```
GET /blocks/:hash
```

Response:

```json
{
    "success": true,
    "data": {
        "timestamp": 1683900000000,
        "lastHash": "previous-block-hash",
        "hash": "requested-block-hash",
        "transactions": [],
        "nonce": 0,
        "difficulty": 4,
        "quantumProof": {...}
    }
}
```

#### Get Block by Height

Retrieves a specific block by its height.

```
GET /blocks/height/:height
```

Response: Same as Get Block by Hash

### Transactions

#### Create Transaction

Creates and broadcasts a new transaction.

```
POST /transactions
```

Request Body:

```json
{
  "sender": "sender-address",
  "recipient": "recipient-address",
  "amount": 100,
  "privateKey": "sender-private-key"
}
```

Response:

```json
{
    "success": true,
    "data": {
        "hash": "transaction-hash",
        "sender": "sender-address",
        "recipient": "recipient-address",
        "amount": 100,
        "timestamp": 1683900000000,
        "signature": {...}
    }
}
```

#### Get Transaction

Retrieves a specific transaction by its hash.

```
GET /transactions/:hash
```

Response:

```json
{
    "success": true,
    "data": {
        "hash": "transaction-hash",
        "sender": "sender-address",
        "recipient": "recipient-address",
        "amount": 100,
        "timestamp": 1683900000000,
        "signature": {...},
        "blockHash": "containing-block-hash",
        "blockHeight": 1234
    }
}
```

#### Get Address Transactions

Retrieves all transactions for a specific address.

```
GET /transactions/address/:address
```

Response:

```json
{
    "success": true,
    "data": [
        {
            "hash": "transaction-hash-1",
            "sender": "address",
            "recipient": "other-address",
            "amount": 100,
            "timestamp": 1683900000000,
            "signature": {...}
        },
        // ... more transactions
    ]
}
```

#### Get Mempool Transactions

Retrieves all unconfirmed transactions in the mempool.

```
GET /mempool
```

Response:

```json
{
    "success": true,
    "data": [
        {
            "hash": "transaction-hash",
            "sender": "sender-address",
            "recipient": "recipient-address",
            "amount": 100,
            "timestamp": 1683900000000,
            "signature": {...}
        },
        // ... more transactions
    ]
}
```

### Wallet

#### Create Wallet

Creates a new quantum-resistant wallet.

```
POST /wallet/create
```

Response:

```json
{
  "success": true,
  "data": {
    "publicKey": "quantum-resistant-public-key",
    "privateKey": "quantum-resistant-private-key",
    "address": "derived-address"
  }
}
```

#### Get Balance

Retrieves the balance for a specific address.

```
GET /wallet/:address/balance
```

Response:

```json
{
  "success": true,
  "data": {
    "address": "queried-address",
    "balance": 1000
  }
}
```

### Network

#### Get Peers

Retrieves the list of connected peers.

```
GET /peers
```

Response:

```json
{
  "success": true,
  "data": {
    "count": 3,
    "peers": ["ws://peer1.example.com:6001", "ws://peer2.example.com:6001", "ws://peer3.example.com:6001"]
  }
}
```

#### Add Peer

Connects to a new peer.

```
POST /peers
```

Request Body:

```json
{
  "peerAddress": "ws://newpeer.example.com:6001"
}
```

Response:

```json
{
  "success": true,
  "message": "Peer added successfully"
}
```

### Node Information

#### Get Node Info

Retrieves information about the current node.

```
GET /info
```

Response:

```json
{
  "success": true,
  "data": {
    "version": "1.0.0",
    "blockHeight": 1234,
    "peerCount": 3,
    "mempoolSize": 50,
    "isSyncing": false,
    "nodePublicKey": "node-public-key"
  }
}
```

## Error Handling

All endpoints follow the same error response format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

Common HTTP status codes:

- 200: Success
- 400: Bad Request
- 404: Not Found
- 500: Internal Server Error

## Rate Limiting

The API implements rate limiting with the following defaults:

- Window: 15 minutes
- Max Requests per Window: 1000

When rate limit is exceeded, the API returns:

```json
{
  "success": false,
  "error": "Rate limit exceeded. Please try again later."
}
```

## Websocket Events

The node also provides real-time updates through WebSocket connections:

```javascript
const socket = new WebSocket("ws://localhost:6001");

socket.on("message", (data) => {
  const message = JSON.parse(data);
  switch (message.type) {
    case "NEW_BLOCK":
      // Handle new block
      break;
    case "NEW_TRANSACTION":
      // Handle new transaction
      break;
    // ... other event types
  }
});
```

## Security Considerations

1. Never share private keys
2. Use HTTPS in production
3. Implement proper rate limiting
4. Monitor for suspicious activity
5. Keep node software updated
