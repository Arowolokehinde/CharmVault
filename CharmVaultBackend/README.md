# CharmVault Backend - Bitcoin Core RPC Proxy

This is a simple CORS proxy that enables the CharmVault frontend to communicate with Bitcoin Core RPC from the browser.

## Why is this needed?

Bitcoin Core's RPC interface doesn't properly support browser CORS requests (specifically OPTIONS preflight requests). This proxy adds proper CORS headers and handles all HTTP methods correctly.

## Setup

1. **Install dependencies**:
```bash
npm install
```

2. **Configure environment variables**:

Edit `.env` file with your Bitcoin Core credentials:
```bash
BITCOIN_RPC_HOST=localhost
BITCOIN_RPC_PORT=18332
BITCOIN_RPC_USER=charmvault
BITCOIN_RPC_PASSWORD=your_secure_password_here
PORT=3001
```

Make sure these match your `bitcoin.conf` settings!

3. **Start the server**:
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

The server will run on `http://localhost:3001`

## Testing

Check if the proxy is running:
```bash
curl http://localhost:3001/health
```

Should return:
```json
{"status":"ok","message":"Bitcoin Core RPC Proxy is running"}
```

## Frontend Configuration

Update your frontend `.env` file to point to the proxy:
```bash
VITE_BITCOIN_RPC_HOST=localhost
VITE_BITCOIN_RPC_PORT=3001  # Proxy port, not Bitcoin Core port!
```

The frontend will now make requests to the proxy, which forwards them to Bitcoin Core.

## Security Note

This proxy is for **development only**. For production, implement proper authentication and rate limiting.
