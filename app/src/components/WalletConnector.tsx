import React, { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WalletName } from "@solana/wallet-adapter-base";
import { shorten, toFixed } from "./utils";
import { Badge } from "./ui/badge";
import { LogOut } from "lucide-react";

export default function WalletConnector () {
  const { connection } = useConnection();
  const {
    select,
    wallets,
    publicKey,
    disconnect,
    connecting,
  } = useWallet();

  const [open, setOpen] = useState<boolean>(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>("");

  useEffect(() => {
    if (!connection || !publicKey) {
      return;
    }

    connection.onAccountChange(
      publicKey,
      (updatedAccountInfo) => {
        setBalance(updatedAccountInfo.lamports / LAMPORTS_PER_SOL);
      },
      "confirmed"
    );

    connection.getAccountInfo(publicKey).then((info) => {
      if (info) {
        setBalance(info?.lamports / LAMPORTS_PER_SOL);
      }
    });
  }, [publicKey, connection]);

  useEffect(() => {
    if (!publicKey) return;
    
    setWalletAddress(publicKey.toBase58());
  }, [publicKey]);

  const handleWalletSelect = async (walletName: WalletName) => {
    if (walletName) {
      try {
        select(walletName);
        setOpen(false);
      } catch (e) {
        console.log(e);
      }
    }
  };

  const handleDisconnect = async () => {
    disconnect();
  };


  return (
    <div className="text-white">
      <Dialog open={open} onOpenChange={setOpen}>
        <div className="flex gap-2 items-center">
          {!publicKey ? (
            <>
              <DialogTrigger asChild>
                <Button>
                  {connecting ? "connecting..." : "Connect Wallet"}
                </Button>
              </DialogTrigger>
            </>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" className="flex gap-2 items-center">
                  <div className="flex items-center gap-2">
                    <img
                      src="https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png"
                      className="rounded-full w-4 h-4"
                    />
                    {toFixed(balance || 0, 2)} SOL
                  </div>
                  <div className="opacity-50">{shorten(walletAddress, 16)}</div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>
                  <button
                    className="w-[200px] flex items-center gap-2"
                    onClick={handleDisconnect}
                  >
                    <LogOut size={16}></LogOut>
                    Disconnect
                  </button>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <DialogHeader>
            <DialogTitle>Connect Wallet</DialogTitle>
          </DialogHeader>
          <DialogContent className="w-[400px]">
            <div className="flex w-full justify-center items-center">
              <div className="w-full flex flex-col justify-start items-center gap-3 overflow-y-auto">
                <div className="text-lg font-bold">Choose wallet</div>
                {wallets.map((wallet) => (
                  <Button
                    key={wallet.adapter.name}
                    variant="outline"
                    className="h-12 flex gap-2 justify-start items-center w-full"
                    onClick={() => handleWalletSelect(wallet.adapter.name)}
                  >
                    <img
                      src={wallet.adapter.icon}
                      alt={wallet.adapter.name}
                      height={24}
                      width={24}
                    />
                    <div>
                      {wallet.adapter.name}
                    </div>
                    {wallet.readyState === 'NotDetected' && <Badge className="ml-auto" variant="destructive">Not installed</Badge>}
                  </Button>
                ))}
              </div>
            </div>
          </DialogContent>
        </div>
      </Dialog>
    </div>
  );
}
