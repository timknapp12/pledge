import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { Keypair, SystemProgram } from "@solana/web3.js";
import { createMint } from "@solana/spl-token";
import {
  setupTestContext,
  initializeConfig,
  airdrop,
  TestContext,
  DEFAULT_TREASURY_SPLIT_BPS,
  DEFAULT_PARTIAL_FEE_BPS,
  DEFAULT_EDIT_PENALTY_BPS,
  DEFAULT_GRACE_PERIOD,
  USDC_DECIMALS,
} from "./utils/helpers";

describe("update_config", () => {
  let ctx: TestContext;

  before(async () => {
    ctx = await setupTestContext();
    await initializeConfig(ctx);
  });

  it("updates treasury", async () => {
    const newTreasury = Keypair.generate();
    await ctx.program.methods
      .updateConfig(newTreasury.publicKey, null, null, null, null, null, null, null, null)
      .accounts({
        admin: ctx.admin.publicKey,
        config: ctx.configPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.admin])
      .rpc();

    const config = await ctx.program.account.programConfig.fetch(ctx.configPda);
    expect(config.treasury.toBase58()).to.equal(newTreasury.publicKey.toBase58());

    // Restore original treasury
    await ctx.program.methods
      .updateConfig(ctx.treasury.publicKey, null, null, null, null, null, null, null, null)
      .accounts({
        admin: ctx.admin.publicKey,
        config: ctx.configPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.admin])
      .rpc();
  });

  it("updates charity", async () => {
    const newCharity = Keypair.generate();
    await ctx.program.methods
      .updateConfig(null, newCharity.publicKey, null, null, null, null, null, null, null)
      .accounts({
        admin: ctx.admin.publicKey,
        config: ctx.configPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.admin])
      .rpc();

    const config = await ctx.program.account.programConfig.fetch(ctx.configPda);
    expect(config.charity.toBase58()).to.equal(newCharity.publicKey.toBase58());

    // Restore
    await ctx.program.methods
      .updateConfig(null, ctx.charity.publicKey, null, null, null, null, null, null, null)
      .accounts({
        admin: ctx.admin.publicKey,
        config: ctx.configPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.admin])
      .rpc();
  });

  it("updates crank authority", async () => {
    const newCrank = Keypair.generate();
    await ctx.program.methods
      .updateConfig(null, null, newCrank.publicKey, null, null, null, null, null, null)
      .accounts({
        admin: ctx.admin.publicKey,
        config: ctx.configPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.admin])
      .rpc();

    const config = await ctx.program.account.programConfig.fetch(ctx.configPda);
    expect(config.crankAuthority.toBase58()).to.equal(newCrank.publicKey.toBase58());

    // Restore original crank authority
    await ctx.program.methods
      .updateConfig(null, null, ctx.crankAuthority.publicKey, null, null, null, null, null, null)
      .accounts({
        admin: ctx.admin.publicKey,
        config: ctx.configPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.admin])
      .rpc();
  });

  it("updates allowed mint", async () => {
    const newMint = await createMint(
      ctx.provider.connection,
      ctx.admin,
      ctx.admin.publicKey,
      null,
      USDC_DECIMALS
    );

    await ctx.program.methods
      .updateConfig(null, null, null, newMint, null, null, null, null, null)
      .accounts({
        admin: ctx.admin.publicKey,
        config: ctx.configPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.admin])
      .rpc();

    const config = await ctx.program.account.programConfig.fetch(ctx.configPda);
    expect(config.allowedMint.toBase58()).to.equal(newMint.toBase58());

    // Restore original mint
    await ctx.program.methods
      .updateConfig(null, null, null, ctx.usdcMint, null, null, null, null, null)
      .accounts({
        admin: ctx.admin.publicKey,
        config: ctx.configPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.admin])
      .rpc();
  });

  it("updates treasury split", async () => {
    await ctx.program.methods
      .updateConfig(null, null, null, null, 8000, null, null, null, null)
      .accounts({
        admin: ctx.admin.publicKey,
        config: ctx.configPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.admin])
      .rpc();

    const config = await ctx.program.account.programConfig.fetch(ctx.configPda);
    expect(config.treasurySplitBps).to.equal(8000);

    // Restore
    await ctx.program.methods
      .updateConfig(null, null, null, null, DEFAULT_TREASURY_SPLIT_BPS, null, null, null, null)
      .accounts({
        admin: ctx.admin.publicKey,
        config: ctx.configPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.admin])
      .rpc();
  });

  it("updates partial fee", async () => {
    await ctx.program.methods
      .updateConfig(null, null, null, null, null, 200, null, null, null)
      .accounts({
        admin: ctx.admin.publicKey,
        config: ctx.configPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.admin])
      .rpc();

    const config = await ctx.program.account.programConfig.fetch(ctx.configPda);
    expect(config.partialFeeBps).to.equal(200);

    // Restore
    await ctx.program.methods
      .updateConfig(null, null, null, null, null, DEFAULT_PARTIAL_FEE_BPS, null, null, null)
      .accounts({
        admin: ctx.admin.publicKey,
        config: ctx.configPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.admin])
      .rpc();
  });

  it("updates edit penalty", async () => {
    await ctx.program.methods
      .updateConfig(null, null, null, null, null, null, 500, null, null)
      .accounts({
        admin: ctx.admin.publicKey,
        config: ctx.configPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.admin])
      .rpc();

    const config = await ctx.program.account.programConfig.fetch(ctx.configPda);
    expect(config.editPenaltyBps).to.equal(500);

    // Restore
    await ctx.program.methods
      .updateConfig(null, null, null, null, null, null, DEFAULT_EDIT_PENALTY_BPS, null, null)
      .accounts({
        admin: ctx.admin.publicKey,
        config: ctx.configPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.admin])
      .rpc();
  });

  it("updates grace period", async () => {
    await ctx.program.methods
      .updateConfig(null, null, null, null, null, null, null, new anchor.BN(7200), null)
      .accounts({
        admin: ctx.admin.publicKey,
        config: ctx.configPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.admin])
      .rpc();

    const config = await ctx.program.account.programConfig.fetch(ctx.configPda);
    expect(config.gracePeriodSeconds.toNumber()).to.equal(7200);

    // Restore
    await ctx.program.methods
      .updateConfig(null, null, null, null, null, null, null, new anchor.BN(DEFAULT_GRACE_PERIOD), null)
      .accounts({
        admin: ctx.admin.publicKey,
        config: ctx.configPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.admin])
      .rpc();
  });

  it("updates paused flag", async () => {
    await ctx.program.methods
      .updateConfig(null, null, null, null, null, null, null, null, true)
      .accounts({
        admin: ctx.admin.publicKey,
        config: ctx.configPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.admin])
      .rpc();

    const config = await ctx.program.account.programConfig.fetch(ctx.configPda);
    expect(config.paused).to.equal(true);

    // Unpause
    await ctx.program.methods
      .updateConfig(null, null, null, null, null, null, null, null, false)
      .accounts({
        admin: ctx.admin.publicKey,
        config: ctx.configPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.admin])
      .rpc();
  });

  it("fails with non-admin signer", async () => {
    const nonAdmin = Keypair.generate();
    await airdrop(ctx.provider.connection, nonAdmin.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);

    try {
      await ctx.program.methods
        .updateConfig(null, null, null, null, null, null, null, null, true)
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

  it("fails with invalid treasury split (> 10000 bps)", async () => {
    try {
      await ctx.program.methods
        .updateConfig(null, null, null, null, 10001, null, null, null, null)
        .accounts({
          admin: ctx.admin.publicKey,
          config: ctx.configPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([ctx.admin])
        .rpc();

      expect.fail("Should have thrown InvalidTreasurySplit error");
    } catch (err) {
      expect(err.message).to.include("InvalidTreasurySplit");
    }
  });

  it("fails with invalid fee (> 1000 bps)", async () => {
    try {
      await ctx.program.methods
        .updateConfig(null, null, null, null, null, 1001, null, null, null)
        .accounts({
          admin: ctx.admin.publicKey,
          config: ctx.configPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([ctx.admin])
        .rpc();

      expect.fail("Should have thrown InvalidFee error");
    } catch (err) {
      expect(err.message).to.include("InvalidFee");
    }
  });

  it("fails with negative grace period", async () => {
    try {
      await ctx.program.methods
        .updateConfig(null, null, null, null, null, null, null, new anchor.BN(-1), null)
        .accounts({
          admin: ctx.admin.publicKey,
          config: ctx.configPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([ctx.admin])
        .rpc();

      expect.fail("Should have thrown InvalidTimestamp error");
    } catch (err) {
      expect(err.message).to.include("InvalidTimestamp");
    }
  });
});
