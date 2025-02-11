# SUI Swap Aggregator

## Overview

This repository implements a token swap script on the SUI mainnet using the Cetus Protocol Aggregator SDK. The main script (`aggregator.ts`) performs the following operations:
- Reads environment variables from a `.env` file.
- Connects to the SUI blockchain using RPC endpoints.
- Validates and decodes a bech32 private key.
- Checks token balances before executing a swap.
- Finds optimal swap routes using the Aggregator SDK.
- Simulates the swap transaction.
- Executes the token swap and checks post-swap balances.

## Prerequisites

- Node.js (>= 14.x)
- npm or yarn

## Installation

1. **Clone the Repository**

   ```sh
   git clone https://github.com/maskedsaqib/sui-aggregator.git
   cd sui-aggregator
   ```

2. **Install Dependencies**

   ```sh
   npm install
   ```

3. **Configure Environment Variables**

   Create a `.env` file in the root of the project with the following variables:

   ```env
   AGGREGATOR_RPC_URL_MAINNET=https://api-sui.cetus.zone/router_v2/find_routes
   FULLNODE_RPC_URL_MAINNET=https://fullnode.mainnet.sui.io:443
   PRIVATE_KEY_BECH32=your_bech32_private_key  # Must start with "suiprivkey1"
   ```

## Usage

You can run the script using `ts-node` or compile the TypeScript code to JavaScript.

- **Using ts-node:**

  ```sh
  npx ts-node aggregator.ts
  ```

- **Using tsc and node:**

  ```sh
  tsc && node aggregator.js
  ```

## Project Structure

- **aggregator.ts:** Main script that handles token swaps on the SUI mainnet.
- **tsconfig.json:** Configuration for TypeScript.
- **package.json:** Project dependencies and scripts.
- **globals.d.ts:** Global module declarations.

## Customization

- Modify the RPC endpoints or adjust the key management logic as needed.
- Extend the code to support additional token pairs or swap features.

## Troubleshooting

- Ensure the `.env` file contains all the required environment variables.
- Verify that the provided private key is in a valid bech32 format (starting with `suiprivkey1`).
- Confirm that your RPC endpoints are accessible and correctly configured.

## License

[Specify your license here]

## Acknowledgements

- Cetus Protocol Aggregator SDK
- SUI Blockchain Tools by @mysten
- BN.js for big number manipulation
- dotenv for environment management # sui-aggregator
