import { fileURLToPath } from 'url';
import path from 'path';
import * as fs from "fs";
import * as snarkjs from "snarkjs";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pourWitnessBuilder = await import(path.join(__dirname ,"../circuits/pour/pour_js//witness_calculator.js"));
const pourwasm = fs.readFileSync(path.join(__dirname, '../circuits/pour/pour_js/pour.wasm'));
const pourzkey = fs.readFileSync(path.join(__dirname, "../zksetup/pour_0000.zkey"));
const vKey = JSON.parse(fs.readFileSync(path.join(__dirname, "../zksetup/verification_key.json")));

export async function buildProof (ask, oldCoin, c1, c2) {
  const input = {
    ask: ask,
    ...oldCoin,
    apk_new: [c1.apk, c2.apk],
    v_new: [c1.value, c2.value],
    rho_new: [c1.rho, c2.rho],
  }
  console.log(input);

  const builder = pourWitnessBuilder.default;
  const pourWC = await builder(pourwasm)
  pourWC
  const witness = await pourWC.calculateWTNSBin(input, 0)

  const { proof, publicSignals } = await snarkjs.groth16.prove(pourzkey, witness)
  console.log("Proof:", proof);
  console.log("Public Signals:", publicSignals);

  return { proof, publicSignals };
}

export async function verifyProof (publicSignals, proof) {
  return await snarkjs.groth16.verify(vKey, publicSignals, proof);
}

