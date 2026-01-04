const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Bitcoin Core RPC configuration
const BITCOIN_RPC_HOST = process.env.BITCOIN_RPC_HOST || 'localhost';
const BITCOIN_RPC_PORT = process.env.BITCOIN_RPC_PORT || '18332';
const BITCOIN_RPC_USER = process.env.BITCOIN_RPC_USER || 'charmvault';
const BITCOIN_RPC_PASSWORD = process.env.BITCOIN_RPC_PASSWORD || 'your_secure_password_here';

const BITCOIN_RPC_URL = `http://${BITCOIN_RPC_HOST}:${BITCOIN_RPC_PORT}`;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Bitcoin Core RPC Proxy is running' });
});

// RPC proxy endpoint
app.post('/rpc', async (req, res) => {
  try {
    console.log('Proxying RPC request:', req.body.method);

    const response = await axios.post(
      BITCOIN_RPC_URL,
      req.body,
      {
        auth: {
          username: BITCOIN_RPC_USER,
          password: BITCOIN_RPC_PASSWORD
        },
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('RPC response received:', response.data.result ? 'Success' : 'Error');
    res.json(response.data);

  } catch (error) {
    console.error('RPC proxy error:', error.message);

    if (error.response) {
      // Bitcoin Core returned an error
      res.status(error.response.status).json({
        error: error.response.data
      });
    } else if (error.code === 'ECONNREFUSED') {
      // Bitcoin Core is not running
      res.status(503).json({
        error: {
          code: -1,
          message: 'Cannot connect to Bitcoin Core. Make sure bitcoind is running.'
        }
      });
    } else {
      // Other errors
      res.status(500).json({
        error: {
          code: -1,
          message: error.message
        }
      });
    }
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`\n🚀 Bitcoin Core RPC Proxy running on http://localhost:${PORT}`);
  console.log(`📍 Proxying requests to: ${BITCOIN_RPC_URL}`);
  console.log(`👤 RPC User: ${BITCOIN_RPC_USER}`);
  console.log(`\n✅ Frontend can now connect to http://localhost:${PORT}/rpc\n`);
});
