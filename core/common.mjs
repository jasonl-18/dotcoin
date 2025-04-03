/* Copyright (C) 2023 Thierry Sans - All Rights Reserved
 */

import { generateMnemonic, mnemonicToSeed } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { HDKey } from "@scure/bip32";
import { randomBytes, verify } from "crypto";
import { keccak_256 } from "@noble/hashes/sha3";
import { base58check } from "@scure/base";
import { poseidon3 } from "poseidon-lite";

import * as utils from "../utils/utils.mjs";

const base58 = base58check(keccak_256);

const CHANGE = 0;
const RECEIVE = 1;
const SHIELDED = 2;

const PRIVATE = 'm';
const PUBLIC = 'M';
const DERIV_PATH = (account, change) => `m/44'/1'/${account}'/${change}`
const PRIV_KEY_LENGTH = 82;

/**
 * returns the mnemonic as a string
 */
export function createMnemonic() {
  const mn = generateMnemonic(wordlist);
  return mn
}

/**
 * returns the receiving key for the given wallet's account
 * @param {string} mnemonic - the wallet's mnemonic phrase
 * @param {number} account - the wallet account index
 */
export async function getReceiveKeys(mnemonic, account) {
    const seed = await mnemonicToSeed(mnemonic);
    const key = HDKey.fromMasterSeed(seed);
    const receivingKey = key.derive(DERIV_PATH(account, RECEIVE));
    return receivingKey;
}

/**
 * returns the changing key pair (public and private) for the given wallet's account
 * @param {string} mnemonic - the wallet's mnemonic phrase
 * @param {number} account - the wallet account index
 */
export async function getChangeKeys(mnemonic, account) {
    const seed = await mnemonicToSeed(mnemonic);
    const key = HDKey.fromMasterSeed(seed);
    const changeKey = key.derive(DERIV_PATH(account, CHANGE));
    return changeKey;
}

export async function getKey(mnemonic, deriv)
{
  const seed = await mnemonicToSeed(mnemonic);
  const key = HDKey.fromMasterSeed(seed);
  const out = key.derive(deriv);
  return out;
}

/**
 * returns the child key(s) for the given parent's key
 * if the parent's key is a public key, it returns the child public key only {publicKey: ...}
 * if the parent's key is a private key, it returns both private and public key {privateKey:, publicKey: }
 * @param {string} key - base58-encoded key (either private or public)
 * @param {number} index - the child key index
 */
export function getChildKeys(key, index) {
  const decodedKey = HDKey.fromExtendedKey(key);
  const childKey = decodedKey.deriveChild(index);

  const childOutput = {"publicKey": childKey.publicExtendedKey};
  if (childKey.privateKey !== null){
    childOutput["privateKey"] = childKey.privateExtendedKey;
  }
  return childOutput;
}

export function isChild(parentExtendedKey, childExtendedKey) {
  const childKey = HDKey.fromExtendedKey(childExtendedKey);
  const derivedChildKey = getChildKeys(parentExtendedKey, childKey.index)
  if (derivedChildKey.publicKey === childExtendedKey || derivedChildKey.publicExtendedKey === childExtendedKey){
    return true;
  }
  else{
    return false;
  }
}

/**
 * returns the base58-encoded signature for a given hash
 * @param {string} hash - base58-encoded hash
 * @param {string} privateKey - base58-encoded private key
 */
export function signHash(hash, privateKey) {
  
  const key = HDKey.fromExtendedKey(privateKey)
  const signature = key.sign(base58.decode(hash));
  return base58.encode(signature);
}

/**
 * returns true or false whether the signature match a given hash
 * @param {string} hash - base58-encoded hash
 * @param {string} publicKey - base58-encoded public key
 * @param {string} sig - base58-encoded signature
 */
export function verifySignature(hash, publicKey, sig) {
  const key = HDKey.fromExtendedKey(publicKey);
  const decodedHash = base58.decode(hash);
  const decodedSig = base58.decode(sig);
  const valid = key.verify(decodedHash, decodedSig);
  return valid;
}

/**
 * 
 * @param {string} address - receiving or change address for which to
 *  find next child hash 
 */
export async function getNextAvailableChild(address, utxos){

  let maxIndex = 0
  for(let utxo of utxos){
    const utxoKey = HDKey.fromExtendedKey(utxo.address);
    if(utxoKey.index >= maxIndex)[
      maxIndex = utxoKey.index + 1
    ]
  }
  const availableKey = getChildKeys(address, maxIndex);
  return availableKey;
}

export async function signUtxos(tHash, mnemonic, account, utxos){

  const receivingKeyPair = await getReceiveKeys(mnemonic, account);
  const changeKeyPair = await getChangeKeys(mnemonic, account);

  let signatures = []
  for(let utxo of utxos){
    const utxoKey = HDKey.fromExtendedKey(utxo);
    let derivedUtxoKey = getChildKeys(receivingKeyPair.privateExtendedKey, utxoKey.index)
    if (derivedUtxoKey.publicKey === utxo || derivedUtxoKey.publicExtendedKey === utxo){
      signatures.push(signHash(tHash, derivedUtxoKey.privateKey))
      continue;
    }
    
    derivedUtxoKey = getChildKeys(changeKeyPair.privateExtendedKey, utxoKey.index)
    if (derivedUtxoKey.publicKey === utxo || derivedUtxoKey.publicExtendedKey === utxo){
      signatures.push(signHash(tHash, derivedUtxoKey.privateKey))
      continue;
    }
  }
  return signatures;
}

function incrementNonce(nonce) {
  for (let i = nonce.length - 1; i >= 0; i--) {
      if (nonce[i] < 255) {
          nonce[i]++;
          break;
      } else {
          nonce[i] = 0; // Carry over to the next byte
      }
  }
}

export function verifyBlockHash(block, difficulty) {
  for (let i = 0; i < difficulty; i++){
    if (block._id[i] !== '1'){
      return false;
    }
  }
  return true;
}

/**
 * returns the complete block data that includes a valid nonce that matches the difficulty and the block _id
 * @param {object} block - incomplete block that includes the previous block _id, the merkle root hash and the timestamp
 * @param {number} difficulty - the number of '1' that should prefix the block _id;
 */
export function findNonce(block, difficulty) {
  const nonce = new Uint8Array (randomBytes(32))
  do {
    incrementNonce(nonce)
    const nonceEncoded = base58.encode(nonce)
    block.nonce = nonceEncoded
    block._id = utils.getBlockHash(block)
  } while (!verifyBlockHash(block, difficulty));
  return block;
}


/**
 * Creates a shielded note
 * @param {number} value - The amount to shield
 * @param {string} publicShieldedKey - The recipient's public shielded key
 * @returns {object} - The note and encrypted note
 */
export function createShieldedCoin(value, publicShieldedKey) {
  const rho = utils.randomBigInt();
  const r = utils.randomBigInt();
  const s = utils.randomBigInt();
  
  const apk = publicShieldedKey;
  const k = poseidon3([apk, rho, r]);
  const cm = poseidon3([value, k, s]);
  
  const coin = { apk, value, rho, r, s, cm };
  const encryptedCoin = {
    amount: coin.value,
    k: k.toString(),
    s: s.toString(),
    cm: cm.toString(),
  }
  return {coin, encryptedCoin};
}

