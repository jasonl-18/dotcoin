/* Copyright (C) 2023 Thierry Sans - All Rights Reserved
 */

import { DatabaseWrite } from "../database/database-write.mjs";

import * as utils from "../utils/utils.mjs";
import * as common from "./common.mjs";

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

export class DotcoinServer {
  /**
   * initializes the Dotcoin server
   * @param {object} config - contains the mnemonic, the mining difficulty, the transaction limit, the coinbase amount and the NeDB path
   */
  constructor(config) {
    this.difficulty = config.difficulty || 1;
    this.limit = config.limit || 1024; // each block can have up to 2^10 transactions (including coinbase)
    this.amount = config.amount || 100; // coinbase amount
    this.path = config.path || "data";
    this.db = new DatabaseWrite(this.path);
  }

  /**
   * verifies (!!) and adds a transaction to the transaction pool
   * @param {object} txParams - the transaction data
   */
  async addTransaction(txParams) {
    
    //await this.verifyTransaction(txParams)
    await this.db.addTransaction(txParams)
    //await this.db.spendUtxos(txParams._id, txParams.utxoIns)
    return txParams
  }

  async verifyTransaction(txParams, coinbase = false){
    //Check input is not null
    if(txParams == null){
      throw new ValidationError(`Transaction parameters input is null`)
    }

    // Check all fields present (structure valid)
    const fields = ["_id", "utxoIns", "utxoOuts", "signatures"]
    for (let field of fields){
      if (txParams[field] == null) {
        throw new ValidationError(`Transaction ${txParams._id} has an empty ${field} field in transaction`)
      }
    }

    //Check transaction id
    const testTransactionHash = utils.getTransactionHash(txParams)
    if(testTransactionHash != txParams._id){
      throw new ValidationError(`Transaction id ${txParams._id} is invalid`)
    }

    // Check utxoIns are unused
    let utxoInAmount = 0
    for (let utxo of txParams.utxoIns){
      const retrievedUtxo = await this.db.getUtxo(utxo);
      if(retrievedUtxo == null){
        throw new ValidationError(`Transaction ${txParams._id} spends a utxo ${utxo} that does not exist`)
      }
      if(retrievedUtxo.txIn != null){
        throw new ValidationError(`Transaction ${txParams._id} spends a utxo ${utxo} that is already spent`)
      }
      utxoInAmount += retrievedUtxo.amount
    }

    //Check utxoOuts
    let utxoOutAmount = 0
    const requiredUtxoOutFields = ["address", "amount"]
    for (let utxo of txParams.utxoOuts){
      for(let field of requiredUtxoOutFields){
        if(utxo[field] == null){
          throw new ValidationError(`Transaction ${txParams._id} utxo has a missing ${field} field`)
        }
      }
      const retrievedUtxo = await this.db.getUtxo(utxo.address);
      if(retrievedUtxo != null){
        throw new ValidationError(`Transaction ${txParams._id} outputs a utxo ${utxo.address} that is already used`)
      }
      utxoOutAmount += utxo.amount
    }

    //Check utxo amounts balance
    if(!coinbase && utxoInAmount < utxoOutAmount){
      throw new ValidationError(`Transaction ${txParams._id} has an utxoIn and utxoOut imbalance`)
    }

    // Checks signatures
    if (txParams.signatures.length != txParams.utxoIns.length){
      throw new ValidationError(`Transaction ${txParams._id} Signature length different from utxo length`)
    }

    let tSignatures = txParams.signatures;
    delete txParams["signatures"]
    const tNoSigHash = utils.getTransactionHash(txParams)
    for (let index in tSignatures){
      const signature = tSignatures[index]
      const utxoIn = txParams.utxoIns[index]
      if(!common.verifySignature(tNoSigHash, utxoIn, signature)){
        throw new ValidationError(`Transaction ${txParams._id} Signature ${signature} is invalid for utxo ${utxoIn}`)
      }
    }
    txParams["signature"] = tSignatures;
  }
  /**
   * verifies (!!) and adds a block to the database
   * it should also verify (!!) add the coinbase transaction and verify (!!) and update all transactions confirmed by the block
   * @param {object} block - the block data
   * @param {object} coinbase - the block's coinbase transaction
   * @param {array<string>} transactions - the list of transaction _ids (non including the coinbase one) that are confirmed by the block
   */
  async addBlock(block, coinbase, transactions) {
    //COINBASE VERIFICATIONS
    //Check coinbase amount valid
    if(coinbase.utxoOuts[0].amount != this.amount){
      throw new ValidationError(`Coinbase transaction ${coinbase._id} has an invalid amount`)
    }

    //TRANSACTIONS VERIFICATION
    //Check if each transaction exists and is unconfirmed
    for (let transactionId of transactions){
      const transaction = await this.getTransaction(transactionId)
      if(transaction == null){
        throw new ValidationError(`Transaction list has a transaction ${transactionId} that does not exist`)
      }
      if(transaction.block != null){
        throw new ValidationError(`Transaction list has a transaction ${transactionId} that is already confirmed`)
      }
    }
    //Check number of transactions is within limit
    if(transactions.length >= this.limit){
      throw new ValidationError(`Transaction list length is over limit: ${this.limit}`)
    }

    //BLOCK VERIFICATION
    //Check genesis block
    if (block.previous == null){
      if((await this.getBlocks(0, 1, -1)).length != 0){
        throw new ValidationError(`A genesis block already exists`)
      }
    }
    else if((await this.getBlock(block.previous)) == null){
      throw new ValidationError(`Block ${block._id} has an invalid previous}`)
    }
    //Check all fields present 
    const requiredFields = ["_id", "root", "nonce"]
    for (let field of requiredFields){
      if (block[field] == null) {
        throw new ValidationError(`Block ${block._id} has an empty ${field} field`)
      }
    }
    //Check correct merkle root hash
    transactions.unshift(coinbase._id)
    const testMerkleRoot = utils.getMerkleRoot(transactions)
    if(testMerkleRoot != block.root){
      throw new ValidationError(`Block root ${block.root} does not match computed merkle root hash ${testMerkleRoot}`)
    }
    //transactions = transactions.slice(1)

    //Check correct block hash with nonce
    const testBlockHash = utils.getBlockHash(block)
    if(testBlockHash !== block._id){
      throw new ValidationError(`Block id ${block._id} does not match computed hash ${testBlockHash}`)
    }
    //Check block difficulty
    if(!common.verifyBlockHash(block, this.difficulty)){
      throw new ValidationError(`Block id ${block._id} does not match difficulty ${this.difficulty}`)
    }

    await this.verifyTransaction(coinbase, true)
    await this.db.addTransaction(coinbase);
    await this.db.addBlock(block);
    await this.db.confirmTransactions(block._id, transactions);
    
    return block;
  }


  /**
   * retrieves a subset of blocks 
   * @param {number} page - the page index
   * @param {numbers} limit - the number of elements per page
   * @param {object} sort - either starting from the oldest one inserted (sort=1) or the latest one inserted (sort=-1)
   */
  async getBlocks(page, limit, sort = 1) {
    return this.db.getBlocks(page, limit, sort);
  }

  /**
   * retrieves the block given its hash
   * @param {string} hash - block's hash
   */
  async getBlock(hash) {
    return this.db.getBlock(hash);
  }

  /**
   * retrieves a subset of transactions
   * @param {number} page - the page index
   * @param {numbers} limit - the number of elements per page
   * @param {object} sort - either starting from the oldest one inserted (sort=1) or the latest one inserted (sort=-1)
   * @param {boolean} unconfirmed - if true, returns only the unconfirmed ones (not mined yet i.e for which the field block == null)
   */
  async getTransactions(page, limit, sort = 1, unconfirmed = false) {
    return this.db.getTransactions(page, limit, sort, unconfirmed);
  }

  /**
   * retrieves the transaction given its hash
   * @param {string} hash - transaction's hash
   */
  async getTransaction(hash) {
    return this.db.getTransaction(hash);
  }

  /**
   * retrieves the utxo (i.e transaction output) for the given address
   * @param {string} address - the address (i.e the public key) of the recipient
   */
  async getUtxo(address) {
    return this.db.getUtxo(address);
  }

  /**
   * erase the directory that stores the NeDB files
   */
  destroy() {
    this.db.destroy();
  }
}
