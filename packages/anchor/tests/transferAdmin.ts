import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { Keypair, SystemProgram } from "@solana/web3.js";
import {
  setupTestContext,
  initializeConfig,
  airdrop,
  TestContext,
} from "./utils/helpers";

describe("transfer_admin", () => {
  let ctx: TestContext;

  before(async () => {
    ctx = await setupTestContext();
    await initializeConfig(ctx);
  });

  it("proposes and accepts admin transfer (two-step)", async () => {
    const newAdmin = Keypair.generate();
    await airdrop(
      ctx.provider.connection,
      newAdmin.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );

    // Step 1: Current admin proposes transfer
    await ctx.program.methods
      .proposeAdminTransfer(newAdmin.publicKey)
      .accounts({
        admin: ctx.admin.publicKey,
        config: ctx.configPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.admin])
      .rpc();

    // Verify pending_admin is set
    let config = await ctx.program.account.programConfig.fetch(ctx.configPda);
    expect(config.pendingAdmin.toBase58()).to.equal(
      newAdmin.publicKey.toBase58()
    );

    // Step 2: New admin accepts
    await ctx.program.methods
      .acceptAdminTransfer()
      .accounts({
        newAdmin: newAdmin.publicKey,
        config: ctx.configPda,
      })
      .signers([newAdmin])
      .rpc();

    // Verify admin changed and pending cleared
    config = await ctx.program.account.programConfig.fetch(ctx.configPda);
    expect(config.admin.toBase58()).to.equal(newAdmin.publicKey.toBase58());
    expect(config.pendingAdmin).to.be.null;

    // Restore original admin for other tests
    await ctx.program.methods
      .proposeAdminTransfer(ctx.admin.publicKey)
      .accounts({
        admin: newAdmin.publicKey,
        config: ctx.configPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([newAdmin])
      .rpc();

    await ctx.program.methods
      .acceptAdminTransfer()
      .accounts({
        newAdmin: ctx.admin.publicKey,
        config: ctx.configPda,
      })
      .signers([ctx.admin])
      .rpc();

    config = await ctx.program.account.programConfig.fetch(ctx.configPda);
    expect(config.admin.toBase58()).to.equal(ctx.admin.publicKey.toBase58());
  });

  it("fails when non-admin proposes transfer", async () => {
    const nonAdmin = Keypair.generate();
    await airdrop(
      ctx.provider.connection,
      nonAdmin.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );

    try {
      await ctx.program.methods
        .proposeAdminTransfer(nonAdmin.publicKey)
        .accounts({
          admin: nonAdmin.publicKey,
          config: ctx.configPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([nonAdmin])
        .rpc();

      expect.fail("Should have thrown Unauthorized error");
    } catch (err) {
      expect(err.message).to.include("Unauthorized");
    }
  });

  it("fails when wrong signer accepts transfer", async () => {
    const newAdmin = Keypair.generate();
    const wrongSigner = Keypair.generate();
    await airdrop(
      ctx.provider.connection,
      newAdmin.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await airdrop(
      ctx.provider.connection,
      wrongSigner.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );

    // Propose transfer
    await ctx.program.methods
      .proposeAdminTransfer(newAdmin.publicKey)
      .accounts({
        admin: ctx.admin.publicKey,
        config: ctx.configPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.admin])
      .rpc();

    // Wrong signer tries to accept
    try {
      await ctx.program.methods
        .acceptAdminTransfer()
        .accounts({
          newAdmin: wrongSigner.publicKey,
          config: ctx.configPda,
        })
        .signers([wrongSigner])
        .rpc();

      expect.fail("Should have thrown NotPendingAdmin error");
    } catch (err) {
      expect(err.message).to.include("NotPendingAdmin");
    }

    // Clean up: clear pending admin by having correct admin accept then transfer back
    await ctx.program.methods
      .acceptAdminTransfer()
      .accounts({
        newAdmin: newAdmin.publicKey,
        config: ctx.configPda,
      })
      .signers([newAdmin])
      .rpc();

    // Transfer back
    await ctx.program.methods
      .proposeAdminTransfer(ctx.admin.publicKey)
      .accounts({
        admin: newAdmin.publicKey,
        config: ctx.configPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([newAdmin])
      .rpc();

    await ctx.program.methods
      .acceptAdminTransfer()
      .accounts({
        newAdmin: ctx.admin.publicKey,
        config: ctx.configPda,
      })
      .signers([ctx.admin])
      .rpc();
  });

  it("fails to accept when no transfer is pending", async () => {
    const randomSigner = Keypair.generate();
    await airdrop(
      ctx.provider.connection,
      randomSigner.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );

    try {
      await ctx.program.methods
        .acceptAdminTransfer()
        .accounts({
          newAdmin: randomSigner.publicKey,
          config: ctx.configPda,
        })
        .signers([randomSigner])
        .rpc();

      expect.fail("Should have thrown NoPendingAdminTransfer error");
    } catch (err) {
      expect(err.message).to.include("NoPendingAdminTransfer");
    }
  });
});
