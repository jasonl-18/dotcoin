/* Copyright (C) 2023 Thierry Sans - All Rights Reserved
 */

import { mnemonicToSeed } from "@scure/bip39";
import { DatabaseRead } from "../database/database-read.mjs";

import * as utils from "../utils/utils.mjs";
import * as common from "./common.mjs";

export class ClientError extends Error {
  constructor(message) {
    super(message);
    this.name = "ClientError";
  }
}

export class DotcoinClient {
  /**
   * initializes the Dotcoin client
   * @param {object} config - contains the mnemonic, the mining difficulty, the transaction limit, the coinbase amount and the NeDB path
   */
  constructor(config) {
    this.mnemonic = config.mnemonic || common.createMnemonic(); // mnemonic for genesis block
    this.difficulty = config.difficulty || 1; // mining difficulty
    this.limit = config.limit || 1024; // each block can have up to 2^8 transactions (including coinbase)
    this.amount = config.amount || 100; // coinbase amount
    this.path = config.path || "data"; // database path
    this.db = new DatabaseRead(this.path);
  }

  /**
   * returns the mnemonic as a string
   */
  getMnemonic() {
    return this.mnemonic;
  }

  /**
   * returns the receiving key (i.e public key) as a string
   * @param {number} account - the wallet account index
   */
  async getReceivingAddress(account) {
    const receivingKey = await common.getReceiveKeys(this.mnemonic, account);
    return receivingKey.publicExtendedKey;
  }

  async getChangeAddress (account) {
    const changeKey = await common.getChangeKeys(this.mnemonic, account);
    return changeKey.publicExtendedKey;
  }

  /* 
  */
  async getAddressUtxos(address, unconfirmed = false, usable = true) {
    let transactions = await this.db.getTransactions(0, 0 , -1);
    if(unconfirmed){
      transactions = transactions.filter(t => t.block == null)
    }
    else{
      transactions = transactions.filter(t => t.block != null)
    }
    
    let utxos = []
    for (let transaction of transactions) {
      let currUtxos = transaction["utxoOuts"]
      if(usable){
        currUtxos = currUtxos.filter(utxo => utxo.txIn == null)
      }
      for (let utxo of currUtxos){
        if (common.isChild(address, utxo.address)){
          utxos.push(utxo)
        }
      }
    }
    return utxos;
  }

  async getAddressAllUtxos(address, usable = true){
    return (await this.getAddressUtxos(address, false, usable)).concat(await this.getAddressUtxos(address, true, usable));
  }

  async getAccountUtxos(account, unconfirmed = false){
    const receivingAddress = await this.getReceivingAddress(account);
    const changeAddress = await this.getChangeAddress(account);
    const utxos = (await this.getAddressUtxos(receivingAddress, unconfirmed)).concat(await this.getAddressUtxos(changeAddress, unconfirmed));
    return utxos;
  }

  /**
   * returns the total of dotcoin owns by the wallet account as a number
   * @param {number} account - the wallet account index
   */
  async getBalance(account) {
    let usableBalance = 0;

    const usableUtxos = await this.getAccountUtxos(account);
    for (let utxo of usableUtxos){
      usableBalance += parseInt(utxo.amount);
    }

    let pendingBalance = 0;
    const pendingUtxos = await this.getAccountUtxos(account, true);
    for (let utxo of pendingUtxos){
      pendingBalance += parseInt(utxo.amount);
    }
    return {"usable" : usableBalance, "pending" : pendingBalance};
  }

  /**
   * returns a transaction candidate
   * @param {number} account - the wallet account index
   * @param {string} address - recipient's receiving address (i.e public key)
   * @param {number} amount - the number of dotcoin to transfer
   */
  async createTransaction(account, address, amount) {
    let transaction = {}
    transaction.block = null
    //Get utxoIns
    let usableUtxos = await this.getAccountUtxos(account);
    usableUtxos.sort((u1, u2) =>  u1.amount - u2.amount);
    let useUtxos = []
    let runningAmount = 0
    let index = 0
    while (index < usableUtxos.length && runningAmount < amount) {
      const currUtxo = usableUtxos[index]
      runningAmount += currUtxo.amount;
      useUtxos.push(currUtxo.address);
      index += 1;
    }
    transaction["utxoIns"] = useUtxos;
    
    transaction["utxoOuts"] = []
    //Get and populate next available receiving utxo
    const receivingUtxos = await this.getAddressAllUtxos(address, false)
    const receivingUtxoKey = await common.getNextAvailableChild(address, receivingUtxos)
    transaction.utxoOuts.push({"address" : receivingUtxoKey.publicKey, "amount" : amount})

    if (runningAmount > amount){
      //Get and populate next available change utxo
      const changeKey = await this.getChangeAddress(account)
      const changeUtxos = await this.getAddressAllUtxos(changeKey, false)
      const changeUtxoKey = await common.getNextAvailableChild(changeKey, changeUtxos);
      transaction.utxoOuts.push({"address" : changeUtxoKey.publicKey, "amount" : runningAmount - amount})
    }
    
    //Sign utxoOuts:
    let tHash = utils.getTransactionHash(transaction);
    transaction.signatures = await common.signUtxos(tHash, this.mnemonic, account, transaction.utxoIns)
    //Get and populate transaction id
    const tHashFinal = utils.getTransactionHash(transaction);
    transaction["_id"] = tHashFinal;

    return transaction;
  }

  async createCoinbaseTransaction (address) {
    let transaction = {}
    transaction["utxoIns"] = []
    transaction["utxoOuts"] = []
    transaction["signatures"] = []
    const receivingUtxos = await this.getAddressAllUtxos(address)
    const receivingUtxoKey = await common.getNextAvailableChild(address, receivingUtxos)
    transaction.utxoOuts.push({"address" : receivingUtxoKey.publicKey, "amount" : this.amount})

    const tHashFinal = utils.getTransactionHash(transaction);
    transaction["_id"] = tHashFinal;
    return transaction
  }

  /**
   * returns a block candidate
   * @param {number} account - the wallet account index that will receives the coinbase amount
   */
  async mine(account) {
    //Get and populate previous block id
    let block = {}
    const prevBlock = (await this.db.getBlocks(0, 1, -1))[0]
    block["previous"] = prevBlock == null ? null : prevBlock._id;

    //Get coinbase transaction
    const receivingAddress = await this.getReceivingAddress(account)
    const coinbase = await this.createCoinbaseTransaction(receivingAddress)

    //get transactions list
    let transactions = (await this.db.getTransactions(0, this.limit-1, -1, true)).map(transaction => transaction._id);
    transactions.unshift(coinbase._id)

    const root = utils.getMerkleRoot(transactions);
    block["root"] = root;
    transactions = transactions.slice(1)

    block = common.findNonce(block, this.difficulty);

    return {block, coinbase, transactions}
  }
}
