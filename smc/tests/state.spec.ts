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

import {
  findContractStateAddress,
  findProgramDataAddress,
} from "./util/entity";
import { airdrop, ONE_SOL } from "./util/setup";

describe("State tests", () => {
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

  beforeAll(async () => {
    testMint = new TestToken(provider);
    await testMint.mint(1_000_000_000);

    await airdrop(provider.connection, authority.publicKey);
    await airdrop(provider.connection, another_authority.publicKey);
  });

  describe("initialize_state", () => {
    it("fail - authority mismatch", async () => {
      const [programData] = findProgramDataAddress();

      await expectThrowError(
        () =>
          program.methods
            .initializeContractState(
              authority.publicKey,
              multiplier,
              eventPrice,
              platformFee,
              orgReward
            )
            .accounts({
              authority: another_authority.publicKey,
              programData,
            })
            .signers([another_authority])
            .rpc(),
        programError("AuthorityMismatch")
      );
    });

    it("success", async () => {
      const [state] = findContractStateAddress();
      const [programData] = findProgramDataAddress();

      const fee = platformFee.addn(1);
      const reward = orgReward.addn(1);
      const price = eventPrice.addn(1);

      await program.methods
        .initializeContractState(
          authority.publicKey,
          multiplier,
          price,
          fee,
          reward
        )
        .accounts({
          authority: provider.publicKey,
          programData,
        })
        .rpc();

      const fetchedStateAccount = await program.account.state.fetch(state);

      expect(fetchedStateAccount.authority).toEqual(authority.publicKey);
      expect(fetchedStateAccount.multiplier.eq(multiplier)).toBeTruthy();
      expect(fetchedStateAccount.platformFee.eq(fee)).toBeTruthy();
      expect(fetchedStateAccount.eventPrice.eq(price)).toBeTruthy();
      expect(fetchedStateAccount.orgReward.eq(reward)).toBeTruthy();
    });

    it("fail - state already exists", async () => {
      const [programData] = findProgramDataAddress();

      await expectThrowError(
        () =>
          program.methods
            .initializeContractState(
              authority.publicKey,
              multiplier,
              eventPrice,
              platformFee,
              orgReward
            )
            .accounts({
              authority: provider.publicKey,
              programData,
            })
            .rpc(),
        /custom program error: 0x0/
      );
    });
  });

  describe("update_state", () => {
    it("fail - authority mismatch", async () => {
      await expectThrowError(
        () =>
          program.methods
            .setContractAuthority(another_authority.publicKey)
            .accounts({
              authority: another_authority.publicKey,
            })
            .signers([another_authority])
            .rpc(),
        programError("AuthorityMismatch")
      );
    });

    it("success - update contract multiplier", async () => {
      const [state] = findContractStateAddress();

      await program.methods
        .setContractMultiplier(multiplier)
        .accounts({
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      const fetchedStateAccount = await program.account.state.fetch(state);

      expect(fetchedStateAccount.multiplier.eq(multiplier)).toBeTruthy();
    });

    it("success - update contract fee", async () => {
      const [state] = findContractStateAddress();

      await program.methods
        .setContractFee(platformFee)
        .accounts({
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      const fetchedStateAccount = await program.account.state.fetch(state);

      expect(fetchedStateAccount.platformFee.eq(platformFee)).toBeTruthy();
    });

    it("success - update org reward", async () => {
      const [state] = findContractStateAddress();

      await program.methods
        .setOrgReward(orgReward)
        .accounts({
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      const fetchedStateAccount = await program.account.state.fetch(state);

      expect(fetchedStateAccount.orgReward.eq(orgReward)).toBeTruthy();
    });

    it("success - update event price", async () => {
      const [state] = findContractStateAddress();

      await program.methods
        .setEventPrice(eventPrice)
        .accounts({
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      const fetchedStateAccount = await program.account.state.fetch(state);

      expect(fetchedStateAccount.eventPrice.eq(eventPrice)).toBeTruthy();
    });

    it("success - update contract authority", async () => {
      const [state] = findContractStateAddress();

      await program.methods
        .setContractAuthority(provider.publicKey)
        .accounts({
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      const fetchedStateAccount = await program.account.state.fetch(state);

      expect(fetchedStateAccount.authority).toEqual(provider.publicKey);
    });
  });
});
