## Deployment checklist (Hardhat/Foundry)

- Deploy Semaphore (or reference deployed address) and its verifier.
- Deploy `GroupManager` with Semaphore address.
- Deploy `SemaphoreWrapper` with Semaphore address.
- Deploy `Verifier` pointing to the Semaphore verifier.
- Deploy `Voting` with Semaphore + GroupManager addresses.
- Register an election group via `GroupManager.registerElectionGroup`.
- Create an election via `Voting.createElection`.
- Add candidates with `Voting.addCandidate`.
- Fund paymaster / set Pimlico or Privy config for AA gas sponsorship.

