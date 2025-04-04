pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "./tree.circom";

template Pour() {
  // Old Coin Inputs
  signal input ask;
  signal input apk;
  signal input value;
  signal input rho;
  signal input cm;
  // signal input merkle_root;
  // signal input treeSiblings[20];
  // signal input treePathIndices[20];

  // Verify input coin
  component cm_hasher = Poseidon(3);
  cm_hasher.inputs <== [apk, value, rho];
  cm === cm_hasher.out;

  // Serial Number of input coin
  signal output sn_old;
  component sn_hasher = Poseidon(2);
  sn_hasher.inputs <== [rho, ask];
  sn_old <== sn_hasher.out;

  // Merkle Proof of old coin CM
  // signal input treeSiblings[20];
  // signal input treePathIndices[20];

  // component tree = MerkleTreeInclusionProof(20);
  // tree.leaf <== cm;
  // for (var i = 0; i < levels; i++) {
  //   tree.siblings[i] <== treeSiblings[i];
  //   tree.pathIndices[i] <== treePathIndices[i];
  // }
  // tree.root === merkle_root;

  // Verify secret/public key pairing
  component a_hasher = Poseidon(1);
  a_hasher.inputs <== [ask];
  apk === a_hasher.out;

  // New Coins Inputs
  signal input apk_new[2];
  signal input v_new[2];
  signal input rho_new[2];
  signal output cm_new[2];

  component cm_hashers[2];

  // New coin commitments valid
  for (var i = 0; i < 2; i++) {
    cm_hashers[i] = Poseidon(3);
    cm_hashers[i].inputs <== [apk_new[i], v_new[i], rho_new[i]];
    cm_new[i] <== cm_hashers[i].out;
  }

  // Value balance valid
  value === v_new[0] + v_new[1];
}

component main = Pour();
