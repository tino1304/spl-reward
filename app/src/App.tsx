import { Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import bs58 from 'bs58';
import { Buffer } from 'buffer';

import { AlphadoReward } from "@/IDL/alphado_reward.ts";
import IDL from "@/IDL/alphado_reward.json"

import { useEffect, useState } from "react";
import { AnchorProvider, BN, Program, Wallet } from "@coral-xyz/anchor";
import { hex } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import WalletConnector from "./components/WalletConnector";
import clsx from "clsx";

const PRIVATE_KEY= ""; //Program Owner
const TOKEN_MINT = "5oQrnYuTJQw68rpghJYd8CRYaDu8tHRor413td81Dn1h";

function App() {
  const [hash, setHash] = useState('');
  const [tokenVault, setTokenVault] = useState('');
  const [encodedTx, setEncodedTx] = useState('');

  const { connection } = useConnection();
  const wallet = useWallet();

  useEffect(() => {
    (async () => {
      const program = new Program<AlphadoReward>(
        IDL as AlphadoReward,
        new AnchorProvider(connection, wallet as unknown as Wallet),
      );

      const [vaultPDA] = await PublicKey.findProgramAddressSync(
        [Buffer.from("vault")],
        program.programId
      );

      setTokenVault(vaultPDA.toString());
    })()
  }, [connection, wallet]);

  const init = async () => {
    if (!wallet?.publicKey) {
      return;
    }

    const program = new Program<AlphadoReward>(
      IDL as AlphadoReward,
      new AnchorProvider(connection, wallet as unknown as Wallet),
    );

    try {
        const [vaultPDA, vaultBump] = await PublicKey.findProgramAddressSync(
          [Buffer.from("vault")],
          program.programId
        );

      console.log(vaultPDA.toString(), 254);
      const hash = await program.methods
        .initialize(vaultBump)
        .accounts({
          vault: vaultPDA,
          mint: new PublicKey(TOKEN_MINT),
          owner: wallet.publicKey,
        })
        .rpc();
      
      setHash(hash);
    } catch (e) {
      console.log("send tx failed", e);
    }
  };

  const backendSign = async () => {
    if (!wallet?.publicKey || !wallet?.signTransaction) {
      return;
    }

    const program = new Program<AlphadoReward>(
      IDL as AlphadoReward,
      new AnchorProvider(connection, wallet as unknown as Wallet),
    );

    const owner = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
    if (!owner) {
      console.log("invalid owner");
      return;
    }

    const [vaultPDA, vaultBump] = await PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      program.programId
    );

    const txBuilder = await program.methods
    // 10 is the amount of ADT that user receive, backend should calculate this amount and set it here
    .claimRewardWithPermission(new BN(10 * LAMPORTS_PER_SOL), vaultBump)
    .accounts({
      vault: vaultPDA,
      owner: new PublicKey(owner.publicKey),
      mint: new PublicKey(TOKEN_MINT),
    }).transaction();

    txBuilder.recentBlockhash = (
      await program.provider.connection.getLatestBlockhash()
    ).blockhash;

    txBuilder.feePayer = wallet.publicKey;

    txBuilder.partialSign(owner);
    
    setEncodedTx(hex.encode(txBuilder.serialize()))
  };

  const frontendSign = async () => {
    if (!wallet?.publicKey || !wallet?.signTransaction || !encodedTx) {
      return;
    }

    const txBuilder = Transaction.from(hex.decode(encodedTx));

    console.log(txBuilder);

    const signedTx = await wallet.signTransaction(txBuilder); // signing the recovered transaction using the creator_wall
    const hash = await connection.sendRawTransaction(
      signedTx.serialize()
    );

    setHash(hash);
  };

  return (
    <div className="flex flex-col gap-3">
      <WalletConnector />
      <div>
        <div>0. Owner initialization (1 time only)</div>
        <button
          className="px-4 py-1 bg-indigo-600 text-white text-center rounded"
          onClick={init}
        >Initialize</button>
      </div>
      <div>
        <div>0,5. Transfer ADT to vault</div>
        Vault address: {tokenVault}
      </div>
      <div>
        <div>1. Backend create instruction and sign (by owner wallet)</div>
        <button
          className="px-4 py-1 bg-indigo-600 text-white text-center rounded"
          onClick={backendSign}
        >Backend sign</button>
      </div>
      <div>
        <div>2. Frontend sign the instruction and execute</div>
        <button
          className={clsx('px-4 py-1 bg-indigo-600 text-white text-center rounded', {
            'opacity-20': !encodedTx
          })}
          onClick={frontendSign}
        >Frontend sign</button>
      </div>
      {
        hash && <div>Hash: {hash}</div>
      }
    </div>
  )
}

export default App
