import {
  web3,
  AnchorProvider,
  setProvider,
  Program,
  workspace,
  BN,
} from "@coral-xyz/anchor";

import { TestToken } from "./util/token";
import {
  airdrop,
  bufferFromString,
  INITIAL_TRUST_LVL,
  ONE_SOL,
  sleep,
  uuidToBn,
} from "./util/setup";

import { Predictory } from "../target/types/predictory";
import { v4 as uuidv4 } from "uuid";
import {
  findContractStateAddress,
  findEventAddress,
  findEventMetaAddress,
  findEventOptionAddress,
  findParticipantAddress,
  findProgramDataAddress,
  findUserAddress,
} from "./util/entity";

const provider = AnchorProvider.env();
setProvider(provider);

const program = workspace.Predictory as Program<Predictory>;

const authority = web3.Keypair.generate();
const another_authority = web3.Keypair.generate();

const alice = web3.Keypair.generate();
const bob = web3.Keypair.generate();
const carol = web3.Keypair.generate();
const eve = web3.Keypair.generate();

let eventId = uuidToBn(uuidv4());

const now = new BN(Math.round(new Date().getTime()) / 1000);
const args = {
  name: Array.from(bufferFromString("Test name", 32)),
  isPrivate: false,
  description: Array.from(bufferFromString("Test Token description", 256)),
  startDate: now.addn(500),
  endDate: now.addn(1000),
  participationDeadline: null,
};

const platformFee = ONE_SOL.muln(33).divn(1000);
const eventPrice = ONE_SOL.muln(33).divn(1000);
const orgReward = new BN(10);
const multiplier = new BN(5);

const participationAmount = ONE_SOL.divn(10);

describe("General event test", () => {
  let testMint: TestToken;

  beforeAll(async () => {
    testMint = new TestToken(provider);
    await testMint.mint(1_000_000_000);

    await airdrop(provider.connection, authority.publicKey);
    await airdrop(provider.connection, another_authority.publicKey);

    await airdrop(provider.connection, alice.publicKey);
    await airdrop(provider.connection, bob.publicKey);
    await airdrop(provider.connection, carol.publicKey);
    await airdrop(provider.connection, eve.publicKey);
  });

  describe("initialize_contract_state", () => {
    it("success", async () => {
      const [state] = findContractStateAddress();
      const [programData] = findProgramDataAddress();

      // Creation:
      try {
        await program.methods
          .setContractAuthority(authority.publicKey)
          .accounts({
            authority: provider.publicKey,
          })
          .rpc();
      } catch (error) {
        if (!error.message.includes("AccountNotInitialized")) {
          throw error;
        }

        await program.methods
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
          .rpc();
      }

      // Fetching user:
      const fetchedStateAccount = await program.account.state.fetch(state);

      expect(fetchedStateAccount.authority).toEqual(authority.publicKey);
      expect(fetchedStateAccount.multiplier.eq(multiplier)).toBeTruthy();
      expect(fetchedStateAccount.eventPrice.eq(eventPrice)).toBeTruthy();
      expect(fetchedStateAccount.platformFee.eq(platformFee)).toBeTruthy();
      expect(fetchedStateAccount.orgReward.eq(orgReward)).toBeTruthy();
    });
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
  });

  describe("transfer_stake", () => {
    it("success", async () => {
      const [user] = findUserAddress(authority.publicKey);

      // Transfer stake:
      await program.methods
        .transferStake(ONE_SOL)
        .accounts({
          sender: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      // Fetching user:
      const fetchedUserAccount = await program.account.user.fetch(user);

      expect(fetchedUserAccount.stake.eq(ONE_SOL)).toBeTruthy();
      expect(fetchedUserAccount.lockedStake.eq(new BN(0))).toBeTruthy();
    });
  });

  describe("withdraw_stake", () => {
    beforeAll(async () => {
      // Transfer stake:
      await program.methods
        .transferStake(ONE_SOL)
        .accounts({
          sender: authority.publicKey,
        })
        .signers([authority])
        .rpc();
    });

    it("success", async () => {
      const [user] = findUserAddress(authority.publicKey);

      // Fetching balance:
      const userBalanceBefore = await provider.connection.getBalance(
        authority.publicKey
      );
      const entityBalanceBefore = await provider.connection.getBalance(user);
      const fetchedUserAccountBefore = await program.account.user.fetch(user);

      // Complete event:
      await program.methods
        .withdrawStake(null)
        .accounts({
          sender: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      // Fetching balance:
      const userBalanceAfter = await provider.connection.getBalance(
        authority.publicKey
      );
      const entityBalanceAfter = await provider.connection.getBalance(user);
      const fetchedUserAccountAfter = await program.account.user.fetch(user);

      expect(userBalanceAfter).toEqual(
        userBalanceBefore + fetchedUserAccountBefore.stake.toNumber()
      );
      expect(entityBalanceAfter).toEqual(
        entityBalanceBefore - fetchedUserAccountBefore.stake.toNumber()
      );
      expect(fetchedUserAccountAfter.stake.eq(new BN(0))).toBeTruthy();
    });
  });

  describe("create_event", () => {
    beforeAll(async () => {
      // Transfer stake:
      await program.methods
        .transferStake(ONE_SOL)
        .accounts({
          sender: authority.publicKey,
        })
        .signers([authority])
        .rpc();
    });

    it("success", async () => {
      const [user] = findUserAddress(authority.publicKey);
      const [event] = findEventAddress(eventId);
      const [eventMeta] = findEventMetaAddress(eventId);

      // Update:
      await program.methods
        .createEvent(eventId, args)
        .accounts({
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      // Fetching event:
      const fetchedEventAccount = await program.account.event.fetch(event);

      expect(fetchedEventAccount.id.eq(eventId)).toBeTruthy();
      expect(fetchedEventAccount.authority).toEqual(authority.publicKey);
      expect(fetchedEventAccount.stake.eq(eventPrice)).toBeTruthy();
      expect(fetchedEventAccount.startDate).toEqual(args.startDate);
      expect(fetchedEventAccount.endDate).toEqual(args.endDate);
      expect(fetchedEventAccount.participationDeadline).toEqual(
        args.participationDeadline
      );
      expect(fetchedEventAccount.optionCount).toEqual(0);
      expect(fetchedEventAccount.canceled).toEqual(false);
      expect(fetchedEventAccount.result).toBeNull();

      const fetchedUserAccount = await program.account.user.fetch(user);

      expect(fetchedUserAccount.stake.eq(ONE_SOL.sub(eventPrice))).toBeTruthy();
      expect(fetchedUserAccount.lockedStake.eq(eventPrice)).toBeTruthy();

      // Fetching event meta:
      const fetchedEventMetaAccount = await program.account.eventMeta.fetch(
        eventMeta
      );

      expect(fetchedEventMetaAccount.isPrivate).toEqual(args.isPrivate);
      expect(fetchedEventMetaAccount.name).toEqual(args.name);
      expect(fetchedEventMetaAccount.description).toEqual(args.description);
    });
  });

  describe("update_event", () => {
    beforeAll(async () => {
      await createNewEvent();
    });

    it("success", async () => {
      const [event] = findEventAddress(eventId);
      const [eventMeta] = findEventMetaAddress(eventId);

      const newName = Array.from(bufferFromString("New test name", 32));
      const newDescription = Array.from(
        bufferFromString("New test description", 256)
      );
      const newEndDate = args.endDate.addn(100);
      const newParticipationDeadline = args.startDate.addn(100);

      // Update name:
      await program.methods
        .updateEventName(eventId, newName)
        .accounts({
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      // Update description:
      await program.methods
        .updateEventDescription(eventId, newDescription)
        .accounts({
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      // Update participation deadline:
      await program.methods
        .updateEventParticipationDeadline(eventId, newParticipationDeadline)
        .accounts({
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      // Update end date:
      await program.methods
        .updateEventEndDate(eventId, newEndDate)
        .accounts({
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      // Fetching event:
      const fetchedEventAccount = await program.account.event.fetch(event);

      expect(fetchedEventAccount.endDate).toEqual(newEndDate);
      expect(fetchedEventAccount.participationDeadline).toEqual(
        newParticipationDeadline
      );

      // Fetching event meta:
      const fetchedEventMetaAccount = await program.account.eventMeta.fetch(
        eventMeta
      );

      expect(fetchedEventMetaAccount.name).toEqual(newName);
      expect(fetchedEventMetaAccount.description).toEqual(newDescription);
    });
  });

  describe("cancel_event", () => {
    it("before start", async () => {
      const now = new BN(Math.round(new Date().getTime()) / 1000);
      await createNewEvent(now.addn(5), now.addn(10));

      const [state] = findContractStateAddress();
      const [event] = findEventAddress(eventId);
      const [user] = findUserAddress(authority.publicKey);
      const fetchedStateAccount = await program.account.state.fetch(state);

      const userBalanceBefore = await provider.connection.getBalance(user);
      const fetcheUserAccountBefore = await program.account.user.fetch(user);

      // Cancel event:
      await program.methods
        .cancelEvent(eventId)
        .accounts({
          sender: authority.publicKey,
          contractAdmin: fetchedStateAccount.authority,
        })
        .signers([authority])
        .rpc();

      // Fetching event:
      const fetchedEventAccount = await program.account.event.fetch(event);

      expect(fetchedEventAccount.canceled).toBeTruthy();

      const userBalanceAfter = await provider.connection.getBalance(user);
      const fetcheUserAccountAfter = await program.account.user.fetch(user);

      expect(
        fetcheUserAccountAfter.stake.eq(
          fetcheUserAccountBefore.stake.add(eventPrice)
        )
      ).toBeTruthy();

      expect(
        fetcheUserAccountAfter.lockedStake.eq(
          fetcheUserAccountBefore.lockedStake.sub(eventPrice)
        )
      ).toBeTruthy();

      expect(userBalanceAfter).toEqual(
        userBalanceBefore + eventPrice.toNumber()
      );
    });

    it("after start", async () => {
      const now = new BN(Math.round(new Date().getTime()) / 1000);
      await createNewEvent(now.subn(5), now.addn(10));

      const [state] = findContractStateAddress();
      const [event] = findEventAddress(eventId);
      const [user] = findUserAddress(authority.publicKey);
      const fetchedStateAccount = await program.account.state.fetch(state);

      const userBalanceBefore = await provider.connection.getBalance(user);
      const fetcheUserAccountBefore = await program.account.user.fetch(user);

      // Cancel event:
      await program.methods
        .cancelEvent(eventId)
        .accounts({
          sender: authority.publicKey,
          contractAdmin: fetchedStateAccount.authority,
        })
        .signers([authority])
        .rpc();

      // Fetching event:
      const fetchedEventAccount = await program.account.event.fetch(event);

      expect(fetchedEventAccount.canceled).toBeTruthy();

      const userBalanceAfter = await provider.connection.getBalance(user);
      const fetcheUserAccountAfter = await program.account.user.fetch(user);

      expect(
        fetcheUserAccountAfter.lockedStake.eq(
          fetcheUserAccountBefore.lockedStake.sub(eventPrice)
        )
      ).toBeTruthy();

      expect(userBalanceAfter).toEqual(userBalanceBefore);
    });

    it("by user after deadline", async () => {
      const now = new BN(Math.round(new Date().getTime()) / 1000);
      await createNewEvent(now.subn(5), now.subn(1));

      const [state] = findContractStateAddress();
      const [event] = findEventAddress(eventId);
      const [user] = findUserAddress(authority.publicKey);
      const fetchedStateAccount = await program.account.state.fetch(state);

      const userBalanceBefore = await provider.connection.getBalance(user);
      const fetcheUserAccountBefore = await program.account.user.fetch(user);

      // Cancel event:
      await program.methods
        .cancelEvent(eventId)
        .accounts({
          sender: another_authority.publicKey,
          contractAdmin: fetchedStateAccount.authority,
        })
        .signers([another_authority])
        .rpc();

      // Fetching event:
      const fetchedEventAccount = await program.account.event.fetch(event);

      expect(fetchedEventAccount.canceled).toBeTruthy();

      const userBalanceAfter = await provider.connection.getBalance(user);
      const fetcheUserAccountAfter = await program.account.user.fetch(user);

      expect(
        fetcheUserAccountAfter.lockedStake.eq(
          fetcheUserAccountBefore.lockedStake.sub(eventPrice)
        )
      ).toBeTruthy();

      expect(userBalanceAfter).toEqual(userBalanceBefore);
    });
  });

  describe("complete_event", () => {
    beforeAll(async () => {
      const now = new BN(Math.round(new Date().getTime()) / 1000);

      await createNewEvent(now.subn(100), now.subn(50));
    });

    it("success", async () => {
      const [event] = findEventAddress(eventId);
      const resIndex = 1;

      // Complete event:
      await program.methods
        .completeEvent(eventId, resIndex)
        .accounts({
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      // Fetching event:
      const fetchedEventAccount = await program.account.event.fetch(event);

      expect(fetchedEventAccount.result).toEqual(resIndex);
    });
  });

  describe("create_option", () => {
    beforeAll(async () => {
      await createNewEvent();
    });

    it("success", async () => {
      // Fetching option index:
      const [event] = findEventAddress(eventId);
      const fetchedEventAccount = await program.account.event.fetch(event);
      const index = fetchedEventAccount.optionCount;

      const [eventOption] = findEventOptionAddress(eventId, index);

      const description = Array.from(bufferFromString("Test description", 256));

      // Create event option:
      await program.methods
        .createEventOption(eventId, index, description)
        .accounts({
          authority: authority.publicKey,
          option: eventOption,
        })
        .signers([authority])
        .rpc();

      // Fetching event option:
      const fetchedEventOptionAccount = await program.account.eventOption.fetch(
        eventOption
      );

      expect(fetchedEventOptionAccount.eventId.eq(eventId)).toBeTruthy();
      expect(fetchedEventOptionAccount.description).toEqual(description);
      expect(fetchedEventOptionAccount.vaultBalance.eq(new BN(0))).toBeTruthy();
      expect(fetchedEventOptionAccount.votes.eq(new BN(0))).toBeTruthy();
    });
  });

  describe("update_option", () => {
    beforeAll(async () => {
      await createNewEvent();

      const [eventOption] = findEventOptionAddress(eventId, 0);
      const description = Array.from(bufferFromString("Test description", 256));

      await program.methods
        .createEventOption(eventId, 0, description)
        .accounts({
          authority: authority.publicKey,
          option: eventOption,
        })
        .signers([authority])
        .rpc();
    });

    it("success", async () => {
      const [eventOption] = findEventOptionAddress(eventId, 0);

      const newDescription = Array.from(
        bufferFromString("New description", 256)
      );

      // Update event option:
      await program.methods
        .updateEventOption(eventId, 0, newDescription)
        .accounts({
          authority: authority.publicKey,
          option: eventOption,
        })
        .signers([authority])
        .rpc();

      // Fetching event option:
      const fetchedEventOptionAccount = await program.account.eventOption.fetch(
        eventOption
      );

      expect(fetchedEventOptionAccount.description).toEqual(newDescription);
    });
  });

  describe("vote", () => {
    beforeAll(async () => {
      await createNewUser(another_authority);

      const now = new BN(Math.round(new Date().getTime()) / 1000);
      await createNewEvent(now.addn(2), now.addn(100));

      await createOption();
      await createOption();
    });

    it("success", async () => {
      // Fetching option index:
      const [event] = findEventAddress(eventId);
      const [user] = findUserAddress(another_authority.publicKey);
      const [participant] = findParticipantAddress(
        eventId,
        another_authority.publicKey
      );
      const [eventOption] = findEventOptionAddress(eventId, 0);

      const userBalanceBefore = await provider.connection.getBalance(user);
      const fetchedUserBefore = await program.account.user.fetch(user);

      await sleep(2000);

      try {
        // Create event option:
        await program.methods
          .vote(eventId, 0, participationAmount)
          .accounts({
            sender: another_authority.publicKey,
            option: eventOption,
          })
          .signers([another_authority])
          .rpc();
      } catch (error) {
        throw new Error(error);
      }

      // Fetching participation:
      const fetchedParticipationAccount =
        await program.account.participation.fetch(participant);

      expect(fetchedParticipationAccount.eventId.eq(eventId)).toBeTruthy();
      expect(fetchedParticipationAccount.payer).toEqual(
        another_authority.publicKey
      );
      expect(fetchedParticipationAccount.option).toEqual(0);
      expect(
        fetchedParticipationAccount.depositedAmount.eq(participationAmount)
      ).toBeTruthy();
      expect(fetchedParticipationAccount.isClaimed).toBeFalsy();
      expect(fetchedParticipationAccount.appealed).toBeFalsy();

      // Fetching event option:
      const fetchedEventOptionAccount = await program.account.eventOption.fetch(
        eventOption
      );

      expect(fetchedEventOptionAccount.votes.eq(new BN(1))).toBeTruthy();
      expect(
        fetchedEventOptionAccount.vaultBalance.eq(participationAmount)
      ).toBeTruthy();

      // Fetching event:
      const fetchedEventAccount = await program.account.event.fetch(event);

      expect(fetchedEventAccount.participationCount.eq(new BN(1))).toBeTruthy();
      expect(
        fetchedEventAccount.totalAmount.eq(participationAmount)
      ).toBeTruthy();
      expect(fetchedEventAccount.totalTrust.eq(INITIAL_TRUST_LVL)).toBeTruthy();

      // Fetching user:
      const userBalanceAfter = await provider.connection.getBalance(user);
      const fetchedUserAccount = await program.account.user.fetch(user);

      expect(
        fetchedUserAccount.stake.eq(
          fetchedUserBefore.stake.sub(participationAmount)
        )
      ).toBeTruthy();

      expect(userBalanceAfter).toEqual(
        userBalanceBefore - participationAmount.toNumber()
      );
    });
  });

  describe("claim_event_reward", () => {
    beforeAll(async () => {
      await createNewUser(alice);
      await createNewUser(bob);
      await createNewUser(carol);
      await createNewUser(eve);

      const now = new BN(Math.round(new Date().getTime()) / 1000);
      await createNewEvent(now.addn(2), now.addn(5), another_authority);

      await createOption(another_authority);
      await createOption(another_authority);

      await sleep(2000);

      await participate(alice, 0);
      await participate(bob, 0);
      await participate(carol, 1);
      await participate(eve, 1);

      await sleep(2000);
      await completeEvent(0, another_authority);
    });

    it("first participant claim", async () => {
      // Fetching option index:
      const [event] = findEventAddress(eventId);
      const [user] = findUserAddress(alice.publicKey);
      const [adminUser] = findUserAddress(another_authority.publicKey);

      const [participant] = findParticipantAddress(eventId, alice.publicKey);
      const [eventOption] = findEventOptionAddress(eventId, 0);

      const adminBalanceBefore = await provider.connection.getBalance(
        adminUser
      );
      const userBalanceBefore = await provider.connection.getBalance(user);
      const contractAdminBalanceBefore = await provider.connection.getBalance(
        authority.publicKey
      );
      const fetchedUserBefore = await program.account.user.fetch(user);
      const fetchedAdminUserBefore = await program.account.user.fetch(
        adminUser
      );

      try {
        // Create event option:
        await program.methods
          .claimEventReward(eventId)
          .accounts({
            sender: alice.publicKey,
            contractAdmin: authority.publicKey,
            option: eventOption,
          })
          .signers([alice])
          .rpc();
      } catch (error) {
        throw new Error(error);
      }

      // Fetching event:
      const fetchedEventAccount = await program.account.event.fetch(event);

      const fetchedAdminUserAfter = await program.account.user.fetch(adminUser);
      const adminBalanceAfter = await provider.connection.getBalance(adminUser);
      const contractAdminBalanceAfter = await provider.connection.getBalance(
        authority.publicKey
      );

      // Reporter released:
      const adminReward = fetchedEventAccount.totalAmount
        .mul(orgReward)
        .divn(100);

      const availableForWinners = fetchedEventAccount.totalAmount
        .sub(adminReward)
        .sub(platformFee);

      expect(fetchedEventAccount.stake.eq(new BN(0))).toBeTruthy();
      expect(
        fetchedAdminUserAfter.stake.eq(
          fetchedAdminUserBefore.stake.add(adminReward).add(eventPrice)
        )
      );
      expect(
        fetchedAdminUserAfter.lockedStake.eq(
          fetchedAdminUserBefore.lockedStake.sub(eventPrice)
        )
      );

      expect(adminBalanceAfter).toEqual(
        adminBalanceBefore + adminReward.toNumber() + eventPrice.toNumber()
      );

      expect(contractAdminBalanceAfter).toEqual(
        contractAdminBalanceBefore + platformFee.toNumber()
      );

      // Fetching participation:
      const fetchedParticipationAccount =
        await program.account.participation.fetch(participant);

      expect(fetchedParticipationAccount.isClaimed).toBeTruthy();
      expect(fetchedParticipationAccount.appealed).toBeFalsy();

      // Fetching user:
      const userBalanceAfter = await provider.connection.getBalance(user);
      const fetchedUserAccount = await program.account.user.fetch(user);
      const fetchedOptionAccount = await program.account.eventOption.fetch(
        eventOption
      );

      const amount = participationAmount
        .div(fetchedOptionAccount.vaultBalance)
        .mul(availableForWinners);

      expect(
        fetchedUserAccount.stake.eq(fetchedUserBefore.stake.add(amount))
      ).toBeTruthy();

      expect(userBalanceAfter).toEqual(userBalanceBefore + amount.toNumber());
    });

    it("second participant claim", async () => {
      // Fetching option index:
      const [event] = findEventAddress(eventId);
      const [user] = findUserAddress(bob.publicKey);
      const [adminUser] = findUserAddress(another_authority.publicKey);

      const [participant] = findParticipantAddress(eventId, bob.publicKey);
      const [eventOption] = findEventOptionAddress(eventId, 0);

      const adminBalanceBefore = await provider.connection.getBalance(
        adminUser
      );
      const userBalanceBefore = await provider.connection.getBalance(user);
      const contractAdminBalanceBefore = await provider.connection.getBalance(
        authority.publicKey
      );
      const fetchedUserBefore = await program.account.user.fetch(user);
      const fetchedAdminUserBefore = await program.account.user.fetch(
        adminUser
      );

      try {
        // Create event option:
        await program.methods
          .claimEventReward(eventId)
          .accounts({
            sender: bob.publicKey,
            contractAdmin: authority.publicKey,
            option: eventOption,
          })
          .signers([bob])
          .rpc();
      } catch (error) {
        throw new Error(error);
      }

      // Fetching event:
      const fetchedEventAccount = await program.account.event.fetch(event);

      const fetchedAdminUserAfter = await program.account.user.fetch(adminUser);
      const adminBalanceAfter = await provider.connection.getBalance(adminUser);
      const contractAdminBalanceAfter = await provider.connection.getBalance(
        authority.publicKey
      );

      // Reporter released:
      const adminReward = fetchedEventAccount.totalAmount
        .mul(orgReward)
        .divn(100);

      const availableForWinners = fetchedEventAccount.totalAmount
        .sub(adminReward)
        .sub(platformFee);

      expect(fetchedEventAccount.stake.eq(new BN(0))).toBeTruthy();
      expect(fetchedAdminUserAfter.stake.eq(fetchedAdminUserBefore.stake));
      expect(
        fetchedAdminUserAfter.lockedStake.eq(fetchedAdminUserBefore.lockedStake)
      );

      expect(adminBalanceAfter).toEqual(adminBalanceBefore);

      expect(contractAdminBalanceAfter).toEqual(contractAdminBalanceBefore);

      // Fetching participation:
      const fetchedParticipationAccount =
        await program.account.participation.fetch(participant);

      expect(fetchedParticipationAccount.isClaimed).toBeTruthy();
      expect(fetchedParticipationAccount.appealed).toBeFalsy();

      // Fetching user:
      const userBalanceAfter = await provider.connection.getBalance(user);
      const fetchedUserAccount = await program.account.user.fetch(user);
      const fetchedOptionAccount = await program.account.eventOption.fetch(
        eventOption
      );

      const amount = participationAmount
        .div(fetchedOptionAccount.vaultBalance)
        .mul(availableForWinners);

      expect(
        fetchedUserAccount.stake.eq(fetchedUserBefore.stake.add(amount))
      ).toBeTruthy();

      expect(userBalanceAfter).toEqual(userBalanceBefore + amount.toNumber());
    });
  });

  describe("recharge", () => {
    beforeAll(async () => {
      const now = new BN(Math.round(new Date().getTime()) / 1000);
      await createNewEvent(now.addn(2), now.addn(5), another_authority);

      await createOption(another_authority);
      await createOption(another_authority);

      await sleep(2000);

      await participate(alice, 0);
      await participate(bob, 1);

      await closeEvent(another_authority);
    });

    it("success", async () => {
      const [user] = findUserAddress(alice.publicKey);
      const [participant] = findParticipantAddress(eventId, alice.publicKey);

      const userBalanceBefore = await provider.connection.getBalance(user);
      const fetchedUserBefore = await program.account.user.fetch(user);

      try {
        // Recharge:
        await program.methods
          .recharge(eventId)
          .accounts({
            sender: alice.publicKey,
          })
          .signers([alice])
          .rpc();
      } catch (error) {
        throw new Error(error);
      }

      // Fetching participation:
      const fetchedParticipationAccount =
        await program.account.participation.fetch(participant);

      expect(fetchedParticipationAccount.isClaimed).toBeTruthy();
      expect(fetchedParticipationAccount.appealed).toBeFalsy();

      // Fetching user:
      const userBalanceAfter = await provider.connection.getBalance(user);
      const fetchedUserAccount = await program.account.user.fetch(user);

      expect(
        fetchedUserAccount.stake.eq(
          fetchedUserBefore.stake.add(participationAmount)
        )
      ).toBeTruthy();

      expect(userBalanceAfter).toEqual(
        userBalanceBefore + participationAmount.toNumber()
      );
    });
  });
});

async function createNewEvent(
  startDate?: BN,
  endDate?: BN,
  owner?: web3.Keypair
) {
  eventId = uuidToBn(uuidv4());

  let newArgs = { ...args };

  if (startDate) {
    newArgs.startDate = startDate;
    newArgs.endDate = startDate.addn(1000);
  }

  if (endDate) {
    newArgs.endDate = endDate;
  }

  const signer = owner ? owner : authority;

  try {
    await program.methods
      .transferStake(ONE_SOL)
      .accounts({
        sender: signer.publicKey,
      })
      .signers([signer])
      .rpc();

    await program.methods
      .createEvent(eventId, newArgs)
      .accounts({
        authority: signer.publicKey,
      })
      .signers([signer])
      .rpc();
  } catch (error) {
    throw new Error(error);
  }
}

async function createNewUser(owner: web3.Keypair) {
  const [user] = findUserAddress(authority.publicKey);
  const name = Array.from(bufferFromString("User name", 32));

  try {
    // Creation:
    await program.methods
      .createUser(name)
      .accounts({
        sender: owner.publicKey,
      })
      .signers([owner])
      .rpc();

    await program.methods
      .transferStake(ONE_SOL)
      .accounts({
        sender: owner.publicKey,
      })
      .signers([owner])
      .rpc();
  } catch (error) {
    throw new Error(error);
  }
}

async function createOption(owner?: web3.Keypair) {
  // Fetching option index:
  const [event] = findEventAddress(eventId);
  const fetchedEventAccount = await program.account.event.fetch(event);
  const index = fetchedEventAccount.optionCount;

  const [eventOption] = findEventOptionAddress(eventId, index);

  const description = Array.from(bufferFromString("Test description", 256));

  const signer = owner ? owner : authority;

  try {
    // Create event option:
    await program.methods
      .createEventOption(eventId, index, description)
      .accounts({
        authority: signer.publicKey,
        option: eventOption,
      })
      .signers([signer])
      .rpc();
  } catch (error) {
    throw new Error(error);
  }
}

async function participate(patricipant: web3.Keypair, index: number) {
  const [eventOption] = findEventOptionAddress(eventId, index);

  try {
    // Create event option:
    await program.methods
      .vote(eventId, index, participationAmount)
      .accounts({
        sender: patricipant.publicKey,
        option: eventOption,
      })
      .signers([patricipant])
      .rpc();
  } catch (error) {
    throw new Error(error);
  }
}

async function completeEvent(index: number, owner?: web3.Keypair) {
  const signer = owner ? owner : authority;

  try {
    // Complete event:
    await program.methods
      .completeEvent(eventId, index)
      .accounts({
        authority: signer.publicKey,
      })
      .signers([signer])
      .rpc();
  } catch (error) {
    throw new Error(error);
  }
}

async function closeEvent(owner?: web3.Keypair) {
  const signer = owner ? owner : authority;

  try {
    // Cancel event:
    await program.methods
      .cancelEvent(eventId)
      .accounts({
        sender: signer.publicKey,
        contractAdmin: authority.publicKey,
      })
      .signers([signer])
      .rpc();
  } catch (error) {
    throw new Error(error);
  }
}
