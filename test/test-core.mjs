import { rmSync } from "fs";
import chai from "chai";
import { DotcoinClient } from "../core/client.mjs";
import { DotcoinServer } from "../core/server.mjs";
import { json } from "stream/consumers";

import * as ZKPour from "../core/ZKPour.mjs";

const expect = chai.expect;

const databasePath = "data/testDb";
import * as utils from '../utils/utils.mjs'

describe("Testing Core Features", function () {
  this.timeout(10000);
  const config = {
    difficulty: 2,
    amount: 100,
    limit: 1024,
  };
  let client1;
  let client2;
  let server;

  before(async function () {
    client1 = new DotcoinClient({ ...config, path: databasePath });
    client2 = new DotcoinClient({ ...config, path: databasePath });
    server = new DotcoinServer({
      ...config,
      path: databasePath,
    });
  });

  after(function () {
    server.destroy();
  });
  it("it should mint a coin", async function () {

    const {coin, tx} = await client1.createMintTransaction(10, 0)

    // const cm = tx.utxoOuts[0].cm

    // utils.addCoinToTree(server.merkleTree, cm);
    // console.log(utils.getMerkleProof(server.merkleTree, cm));
    

    // const transaction = await server.addTransaction(tx);
    // console.log(JSON.stringify(await client1.db.getTransactions(0,0)))
  })

  it("it should create a pour transaction", async function () {
    const { coin:cA1, tx:tx_mint_cA1 } = await client1.createMintTransaction(100, 0)
    await server.addTransaction(tx_mint_cA1);
    const { coin:cA2, tx:tx_mint_cA2 } = await client1.createMintTransaction(50, 0)
    await server.addTransaction(tx_mint_cA2);

    const merkleProof = await server.getMerkleProof(cA1.cm);
    const { tx:tx_pour , c1, c2 } = await client1.createPourTransaction(cA1, merkleProof, 10, 90, client2.shieldedTransmissionKey);
    await server.addTransaction(tx_pour);
    console.log(tx_pour)
  })

  // it("it should create the genesis block", async function () {
  //   const { block, coinbase, transactions } = await client1.mine(0);
  //   const blockMined = await server.addBlock(block, coinbase, transactions);
  // });

  // it("it should return the balances", async function () {
  //   const { usable: usable1, pending: pending1 } = await client1.getBalance(0);
  //   expect(usable1).to.be.equal(100);
  //   expect(pending1).to.be.equal(0);
  //   const { usable: usable2, pending: pending2 } = await client2.getBalance(0);
  //   expect(usable2).to.be.equal(0);
  //   expect(pending2).to.be.equal(0);
  // });

  // it("it should add a transaction", async function () {
  //   const txParams = await client1.createTransaction(
  //     0,
  //     await client2.getReceivingAddress(0),
  //     10,
  //   );
  //   const transaction = await server.addTransaction(txParams);
  // });

  // it("it should return the updated balances", async function () {
  //   const { usable: usable1, pending: pending1 } = await client1.getBalance(0);
  //   expect(usable1).to.be.equal(0);
  //   expect(pending1).to.be.equal(90);
  //   const { usable: usable2, pending: pending2 } = await client2.getBalance(0);
  //   expect(usable2).to.be.equal(0);
  //   expect(pending2).to.be.equal(10);
  // });

  // it("it should mine a block", async function () {
  //   const { block, coinbase, transactions } = await client2.mine(0);
  //   const blockMined = await server.addBlock(block, coinbase, transactions);
  // });

  // it("it should return the updated balances", async function () {
  //   const { usable: usable1, pending: pending1 } = await client1.getBalance(0);
  //   expect(usable1).to.be.equal(90);
  //   expect(pending1).to.be.equal(0);
  //   const { usable: usable2, pending: pending2 } = await client2.getBalance(0);
  //   expect(usable2).to.be.equal(110);
  //   expect(pending2).to.be.equal(0);
  // });

  // it("it should add another transaction", async function () {
  //   const txParams = await client2.createTransaction(
  //     0,
  //     await client1.getReceivingAddress(0),
  //     30,
  //   );
  //   const transaction = await server.addTransaction(txParams);
  // });

  // it("it should return the updated balances", async function () {
  //   const { usable: usable1, pending: pending1 } = await client1.getBalance(0);
  //   expect(usable1).to.be.equal(90);
  //   expect(pending1).to.be.equal(30);
  //   const { usable: usable2, pending: pending2 } = await client2.getBalance(0);
  //   expect(usable2).to.be.equal(0);
  //   expect(pending2).to.be.equal(80);
  // });

  // it("it should mine another block", async function () {
  //   const { block, coinbase, transactions } = await client1.mine(0);
  //   const blockMined = await server.addBlock(block, coinbase, transactions);
  // });

  // it("it should return the final balances", async function () {
  //   const { usable: usable1, pending: pending1 } = await client1.getBalance(0);
  //   expect(usable1).to.be.equal(220);
  //   expect(pending1).to.be.equal(0);
  //   const { usable: usable2, pending: pending2 } = await client2.getBalance(0);
  //   expect(usable2).to.be.equal(80);
  //   expect(pending2).to.be.equal(0);
  // });
});

