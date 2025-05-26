import {
  web3,
  AnchorProvider,
  setProvider,
  Program,
  workspace,
  BN,
} from "@coral-xyz/anchor";

import { expectThrowError } from "./util/console";
import { programError } from "./util/error";
import { TestToken } from "./util/token";

import { Predictory } from "../target/types/predictory";

import { findProgramDataAddress, findUserAddress } from "./util/entity";
import {
  airdrop,
  bufferFromString,
  INITIAL_TRUST_LVL,
  ONE_SOL,
} from "./util/setup";

describe("User tests", () => {
  const provider = AnchorProvider.env();
  setProvider(provider);

  const program = workspace.Predictory as Program<Predictory>;

  const authority = web3.Keypair.generate();
  const another_authority = web3.Keypair.generate();

  let testMint: TestToken;

  const platformFee = ONE_SOL.muln(33).divn(1000);
  const eventPrice = ONE_SOL.muln(33).divn(1000);
  const orgReward = new BN(10);
  const multiplier = new BN(5);

  const amount = new BN(1000);

  beforeAll(async () => {
    testMint = new TestToken(provider);
    await testMint.mint(1_000_000_000);

    await airdrop(provider.connection, authority.publicKey);
    await airdrop(provider.connection, another_authority.publicKey);

    const [programData] = findProgramDataAddress();

    try {
      await program.methods
        .initializeContractState(
          provider.publicKey,
          multiplier,
          eventPrice,
          platformFee,
          orgReward
        )
        .accounts({
          authority: provider.publicKey,
          programData,
        })
        .rpc();
    } catch (error) {
      if (!error.message.includes("custom program error: 0x0")) {
        throw error;
      }
    }
  });

  describe("create_user", () => {
    it("success", async () => {
      const [user] = findUserAddress(authority.publicKey);
      const name = Array.from(bufferFromString("User name", 32));

      // Creation:
      await program.methods
        .createUser(name)
        .accounts({
          sender: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      // Fetching user:
      const fetchedUserAccount = await program.account.user.fetch(user);

      expect(fetchedUserAccount.payer).toEqual(authority.publicKey);
      expect(fetchedUserAccount.name).toEqual(name);
      expect(fetchedUserAccount.stake.eq(new BN(0))).toBeTruthy();
      expect(fetchedUserAccount.lockedStake.eq(new BN(0))).toBeTruthy();
      expect(fetchedUserAccount.trustLvl.eq(INITIAL_TRUST_LVL)).toBeTruthy();
    });

    it("fail - user already exists", async () => {
      const name = Array.from(bufferFromString("New name", 32));

      await expectThrowError(
        () =>
          program.methods
            .createUser(name)
            .accounts({
              sender: authority.publicKey,
            })
            .signers([authority])
            .rpc(),
        /custom program error: 0x0/
      );
    });
  });

  describe("transfer_stake", () => {
    it("fail - authority mismatch", async () => {
      await expectThrowError(
        () =>
          program.methods
            .transferStake(amount)
            .accounts({
              sender: another_authority.publicKey,
            })
            .signers([another_authority])
            .rpc(),
        /AccountNotInitialized/
      );
    });

    it("success", async () => {
      const [user] = findUserAddress(authority.publicKey);

      await program.methods
        .transferStake(amount)
        .accounts({
          sender: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      const fetchedUserAccount = await program.account.user.fetch(user);

      expect(fetchedUserAccount.stake.eq(amount)).toBeTruthy();
    });
  });

  describe("withdraw_stake", () => {
    it("fail - authority mismatch", async () => {
      await expectThrowError(
        () =>
          program.methods
            .withdrawStake(null)
            .accounts({
              sender: another_authority.publicKey,
            })
            .signers([another_authority])
            .rpc(),
        /AccountNotInitialized/
      );
    });

    it("fail - insufficient funds", async () => {
      await expectThrowError(
        () =>
          program.methods
            .withdrawStake(amount.addn(1))
            .accounts({
              sender: authority.publicKey,
            })
            .signers([authority])
            .rpc(),
        programError("InsufficientFunds")
      );
    });

    it("success - partial withdraw", async () => {
      const [user] = findUserAddress(authority.publicKey);

      const userBalanceBefore = await provider.connection.getBalance(
        authority.publicKey
      );

      await program.methods
        .withdrawStake(amount.divn(2))
        .accounts({
          sender: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      const fetchedUserAccount = await program.account.user.fetch(user);

      expect(fetchedUserAccount.stake.eq(amount.divn(2))).toBeTruthy();

      const userBalanceAfter = await provider.connection.getBalance(
        authority.publicKey
      );

      expect(userBalanceAfter).toEqual(
        userBalanceBefore + amount.divn(2).toNumber()
      );
    });

    it("success - full withdraw", async () => {
      const [user] = findUserAddress(authority.publicKey);

      const userBalanceBefore = await provider.connection.getBalance(
        authority.publicKey
      );

      const fetchedUserAccountBefore = await program.account.user.fetch(user);

      await program.methods
        .withdrawStake(null)
        .accounts({
          sender: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      const fetchedUserAccount = await program.account.user.fetch(user);

      expect(fetchedUserAccount.stake.isZero()).toBeTruthy();

      const userBalanceAfter = await provider.connection.getBalance(
        authority.publicKey
      );

      expect(userBalanceAfter).toEqual(
        userBalanceBefore + fetchedUserAccountBefore.stake.toNumber()
      );
    });
  });
});
