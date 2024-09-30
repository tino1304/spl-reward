import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
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
const TOKEN_DECIMALS = 9;

function App() {
  const [hash, setHash] = useState('');
  const [tokenVault, setTokenVault] = useState('');
  const [encodedTx, setEncodedTx] = useState('');

  const { connection } = useConnection();
  const wallet = useWallet();

  const gettUserAccount = async () => {
    if (!wallet?.publicKey) {
      console.log('invalid wallet');
      return;
    }

    const program = new Program<AlphadoReward>(
      IDL as AlphadoReward,
      new AnchorProvider(connection, wallet as unknown as Wallet),
    );

    const [userAccountPda] = await PublicKey.findProgramAddressSync(
      [Buffer.from("user"), wallet.publicKey.toBuffer()],
      program.programId
    );
  
    // Fetch the user account data
    const userAccount = await program.account.userAccount.fetch(userAccountPda).catch(e => {
      console.log(e);
      return null;
    });
    console.log("UserAccount data:",
      userAccount?.claimedAmount?.toNumber(),
      userAccount?.maxClaimableAmount?.toNumber(),
      userAccount?.nonce?.toNumber()
    );

    return userAccount;
  }

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
      console.log('invalid wallet');
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

    // vault - token_account for the reward contract
    const [vaultPDA, vaultBump] = await PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      program.programId
    );

    // user on-chain data, including:
    // 1. nonce: a kind of index, increase by 1 each time user call claim
    // 2. claimed_amount
    // 3. max_claimable_amount
    const userAccount = await gettUserAccount();

    const claimAmount = 10;
    // The overall claimable amount of a user
    // user claim the first time with 10 ADT, max_claimable_amount = 10
    // user claim the second time with 20 ADT, max_claimable_amount = 30
    // user claim the 3rd time with 25 ADT, max_claimable_amount = 45
    const maxClaimableAmount = userAccount?.maxClaimableAmount 
      ? userAccount.maxClaimableAmount.toNumber() / (10**TOKEN_DECIMALS) + claimAmount
      : claimAmount;

    // calculate new nonce
    const nonce = userAccount?.nonce ? userAccount.nonce.toNumber() + 1 : 1;

    // transaction builder
    const txBuilder = await program.methods
    .claimRewardWithPermission(
      new BN(claimAmount * (10 ** TOKEN_DECIMALS)),
      vaultBump,
      new BN(maxClaimableAmount * (10 ** TOKEN_DECIMALS)),
      new BN(nonce),
    )
    .accounts({
      vault: vaultPDA,
      owner: new PublicKey(owner.publicKey),
      mint: new PublicKey(TOKEN_MINT),
    }).transaction();

    // require this config
    txBuilder.recentBlockhash = (
      await program.provider.connection.getLatestBlockhash()
    ).blockhash;

    // require this config
    txBuilder.feePayer = wallet.publicKey;

    // backend sign
    txBuilder.partialSign(owner);
    
    // encode transaction and return to FE
    setEncodedTx(txBuilder.serialize({ requireAllSignatures: false }).toString('hex'))
  };

  const frontendSign = async () => {
    if (!wallet?.publicKey || !wallet?.signTransaction || !encodedTx) {
      return;
    }

    const txBuilder = Transaction.from(hex.decode(encodedTx));

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
