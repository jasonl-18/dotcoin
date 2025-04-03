
circom circuits/pour/pour.circom --wasm --sym --r1cs -o circuits/pour

#Powers of Tau
snarkjs powersoftau new bn128 14 zksetup/pot12_0000.ptau -v
snarkjs powersoftau contribute zksetup/pot12_0000.ptau zksetup/pot12_0001.ptau --name="First contribution" -v

#Phase 2
snarkjs powersoftau prepare phase2 zksetup/pot12_0001.ptau zksetup/pot12_final.ptau -v

snarkjs groth16 setup circuits/pour/pour.r1cs zksetup/pot12_final.ptau zksetup/pour_0000.zkey
snarkjs zkey contribute zksetup/pour_0000.zkey zksetup/pour_0001.zkey --name="1st Contributor Name" -v 
snarkjs zkey export verificationkey zksetup/pour_0001.zkey zksetup/verification_key.json
snarkjs zkey export verificationkey zksetup/pour_0000.zkey zksetup/verification_key.json
