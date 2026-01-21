import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
// TODO - build types for the program
// TODO - but first double check admin wallet
import { Pledge } from "../target/types/pledge";

describe("pledge", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Pledge as Program<Pledge>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
