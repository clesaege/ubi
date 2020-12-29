const BigNumber = web3.BigNumber;
const UBI = artifacts.require('UBI');

const { expect } = require("chai");

/*
  .use(require('chai-bignumber')(BigNumber))
  .should();
*/

/*
require('chai')
  .use(require('chai-bignumber')(BigNumber))
  .should();
  
*/

contract('UBI', accounts => {
  const _name = "Democracy Earth";
  const _symbol = "UBI";
  // const _decimals = web3.utils.toBN('18');
  const _supply = 10000000;
  const _rate = 1000

 

  /* beforeEach(async () => {
    this.token = await UBI.new(_supply, _name, _symbol);
  }); */

  describe('UBI coin deploy', () => {

    before(async () => {
      accounts = await ethers.getSigners();
  
      const [_addresses, mockProofOfHumanity] = await Promise.all([
        Promise.all(accounts.map((account) => account.getAddress())),
        waffle.deployMockContract(
          accounts[0],
          require("../artifacts/contracts/UBI.sol/IProofOfHumanity.json").abi
        ),
      ]);
      addresses = _addresses;
      setSubmissionIsRegistered = (submissionID, isRegistered) =>
        mockProofOfHumanity.mock.getSubmissionInfo
          .withArgs(submissionID)
          .returns(0, 0, 0, 0, isRegistered, false, 0);
  
      UBICoin = await (
        await ethers.getContractFactory("UBI")
      ).deploy(_supply, _name, _symbol, _rate, mockProofOfHumanity.address);
  
      await UBICoin.deployed();
    });

    it("Allows the governor to change `accruedPerBlock`.", async () => {
      // Check that the value passed to the constructor is set.
      expect(await UBICoin.accruedPerSecond()).to.equal(_rate);
  
      // Make sure it reverts if we are not the governor.
      await expect(
        UBICoin.connect(accounts[1]).changeAccruedPerSecond(2)
      ).to.be.revertedWith("The caller is not the governor.");
  
      // Set the value to 2.
      await UBICoin.changeAccruedPerSecond(2);
      expect(await UBICoin.accruedPerSecond()).to.equal(2);
    });


    it("Allows registered submissions to start accruing UBI.", async () => {
      // Check that the initial `accruingSinceBlock` value is 0.
      expect(await proofOfHumanityUBI.accruingSinceBlock(addresses[1])).to.equal(
        0
      );

      // Make sure it reverts if the submission is not registered.
      await setSubmissionIsRegistered(addresses[1], false);
      await expect(
        proofOfHumanityUBI.startAccruing(addresses[1])
      ).to.be.revertedWith(
        "The submission is not registered in Proof Of Humanity."
      );

      // Start accruing UBI and check that the current block number was set.
      await setSubmissionIsRegistered(addresses[1], true);
      const {blockNumber} = await proofOfHumanityUBI.startAccruing(addresses[1]);
      expect(await proofOfHumanityUBI.accruingSinceBlock(addresses[1])).to.equal(
        blockNumber
      );

      // Make sure it reverts if you try to accrue UBI while already accruing UBI.
      await expect(
        proofOfHumanityUBI.startAccruing(addresses[1])
      ).to.be.revertedWith("The submission is already accruing UBI.");
    });

    it("Allows the withdrawal of accrued UBI.", async () => {
      // Make sure it reverts if the submission is not registered.
      await setSubmissionIsRegistered(addresses[1], false);
      await expect(
        proofOfHumanityUBI.withdrawAccrued(addresses[1])
      ).to.be.revertedWith(
        "The submission is not registered in Proof Of Humanity."
      );

      // Make sure it reverts if the submission is not accruing UBI.
      await setSubmissionIsRegistered(addresses[2], true);
      await expect(
        proofOfHumanityUBI.withdrawAccrued(addresses[2])
      ).to.be.revertedWith("The submission is not accruing UBI.");

      // Make sure it reverts if the token transfer fails.
      await setSubmissionIsRegistered(addresses[1], true);
      await setTransferSuccess(false);
      await expect(
        proofOfHumanityUBI.withdrawAccrued(addresses[1])
      ).to.be.revertedWith("Token transfer failed.");
      await setTransferSuccess(true);

      // Withdraw UBI and verify that `accruingSinceBlock` was reset.
      // Also verify that the accrued UBI was sent correctly.
      const accruingSinceBlock = await proofOfHumanityUBI.accruingSinceBlock(
        addresses[1]
      );
      const withdrawal = proofOfHumanityUBI.withdrawAccrued(addresses[1]);
      const {blockNumber} = await withdrawal;
      expect(await proofOfHumanityUBI.accruingSinceBlock(addresses[1])).to.equal(
        blockNumber
      );
      await expect(withdrawal)
        .to.emit(proofOfHumanityUBI, "Withdrawal")
        .withArgs(
          addresses[1],
          addresses[1],
          accruingSinceBlock.sub(blockNumber).mul(-2)
        );
    });

    it("Allows anyone to report a removed submission for their accrued UBI.", async () => {
      // Make sure it reverts if the submission is still registered.
      await expect(
        proofOfHumanityUBI.reportRemoval(addresses[1])
      ).to.be.revertedWith(
        "The submission is still registered in Proof Of Humanity."
      );

      // Make sure it reverts if the submission is not accruing UBI.
      await setSubmissionIsRegistered(addresses[2], false);
      await expect(
        proofOfHumanityUBI.reportRemoval(addresses[2])
      ).to.be.revertedWith("The submission is not accruing UBI.");

      // Make sure it reverts if the token transfer fails.
      await setSubmissionIsRegistered(addresses[1], false);
      await setTransferSuccess(false);
      await expect(
        proofOfHumanityUBI.reportRemoval(addresses[1])
      ).to.be.revertedWith("Token transfer failed.");
      await setTransferSuccess(true);

      // Report submission and verify that `accruingSinceBlock` was reset.
      // Also verify that the accrued UBI was sent correctly.
      const accruingSinceBlock = await proofOfHumanityUBI.accruingSinceBlock(
        addresses[1]
      );
      const withdrawal = proofOfHumanityUBI.reportRemoval(addresses[1]);
      const {blockNumber} = await withdrawal;
      expect(await proofOfHumanityUBI.accruingSinceBlock(addresses[1])).to.equal(
        0
      );
      await expect(withdrawal)
        .to.emit(proofOfHumanityUBI, "Withdrawal")
        .withArgs(
          addresses[1],
          addresses[0],
          accruingSinceBlock.sub(blockNumber).mul(-2)
        );
    });

    it("Returns 0 for submissions that are not accruing UBI.", async () => {
      expect(await proofOfHumanityUBI.getAccruedValue(addresses[1])).to.equal(0);
    });

/*
    it('has the correct name', async () => {
      const name = await this.token.name();
      name.should.equal(_name);
    });

    it('has the correct symbol', async () => {
      const symbol = await this.token.symbol();
      symbol.should.equal(_symbol);
    });

    it('has the correct decimals', async () => {
      const decimals = await this.token.decimals();
      decimals.should.be.bignumber.eql(_decimals);
    });
*/
  });
})