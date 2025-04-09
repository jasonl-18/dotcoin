# ZDotcoin

ZDotcoin is a privacy-focused cryptocurrency implementation inspired by Zcash, offering both transparent and shielded transactions with zero-knowledge proofs.

## Architecture

ZDotcoin is built with the following components:

- **Client**: Manages wallets, creates transactions, and mines blocks
- **Server**: Validates transactions and blocks, maintains the blockchain
- **Database**: Stores transactions and blocks using NeDB
- **ZK Circuit**: Handles the zero-knowledge proofs for shielded transactions

## setup and run

```bash
npm install
npm run test
```

### Running the Server

We don't have a wallet implementation yet, so we will just directly use the test file.

```bash
npm run test
```

## Development

### Generating Zero-Knowledge Proof Setup

ZDotcoin uses circom for zero-knowledge circuits. To generate the setup:

```bash
./circom.sh
```

## Privacy Features

ZDotcoin implements privacy features similar to Zcash:

- **Shielded Addresses**: Generate private addresses for receiving funds
- **Commitment Merkle Tree**: Track shielded coins without revealing their ownership
- **Zero-Knowledge Proofs**: Prove transaction validity without revealing transaction details
- **Mint Operation**: Convert transparent coins to shielded coins
- **Pour Operation**: Transfer shielded coins privately between addresses

## Link reference

 - [Zellic](https://www.zellic.io/blog/how-does-zcash-work/)
 - [ZeroCash](http://zerocash-project.org/how_zerocash_works)
 - [ZCash](https://zcash.readthedocs.io/en/latest/rtd_pages/basics.html)
