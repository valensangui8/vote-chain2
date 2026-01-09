// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Interfaces.sol";
import "./GroupManager.sol";

/// @title Voting
/// @notice Semaphore v4 based anonymous voting with nullifier checks and candidate storage
contract Voting {
    struct Election {
        uint256 id;
        uint256 groupId;
        uint256 externalNullifier;
        uint64 startsAt;
        uint64 endsAt;
        address owner;
        bool isPublic;
        bool exists;
    }

    struct Candidate {
        uint256 id;
        string name;
        string image;
        uint256 voteCount;
    }

    event ElectionCreated(
        uint256 indexed electionId,
        uint256 indexed groupId,
        uint256 externalNullifier,
        uint64 startsAt,
        uint64 endsAt,
        address indexed owner,
        bool isPublic
    );
    event CandidateAdded(uint256 indexed electionId, uint256 indexed candidateId, string name, string image);
    event VoteCast(
        uint256 indexed electionId,
        uint256 indexed candidateId,
        uint256 nullifier,
        uint256 message
    );

    error ElectionNotActive();
    error ElectionNotFound();
    error ElectionAlreadyExists();
    error NullifierAlreadyUsed();
    error NotOwner();
    error InvalidCandidate();

    ISemaphore public immutable semaphore;
    GroupManager public immutable groupManager;

    mapping(uint256 => Election) public elections;
    mapping(uint256 => Candidate[]) public electionCandidates;
    mapping(uint256 => bool) public nullifierUsed;

    constructor(address semaphoreAddress, address groupManagerAddress) {
        semaphore = ISemaphore(semaphoreAddress);
        groupManager = GroupManager(groupManagerAddress);
    }

    /// @notice Create a new election
    /// @param electionId Your system's election ID
    /// @param groupId The Semaphore group ID (from GroupManager.registerElectionGroup)
    /// @param externalNullifier The external nullifier for this election
    /// @param startsAt Unix timestamp when voting starts (0 = immediately)
    /// @param endsAt Unix timestamp when voting ends (0 = no end)
    /// @param isPublic Whether the election results are publicly viewable
    function createElection(
        uint256 electionId,
        uint256 groupId,
        uint256 externalNullifier,
        uint64 startsAt,
        uint64 endsAt,
        bool isPublic
    ) external {
        if (elections[electionId].exists) revert ElectionAlreadyExists();
        
        elections[electionId] = Election({
            id: electionId,
            groupId: groupId,
            externalNullifier: externalNullifier,
            startsAt: startsAt,
            endsAt: endsAt,
            owner: msg.sender,
            isPublic: isPublic,
            exists: true
        });
        
        emit ElectionCreated(electionId, groupId, externalNullifier, startsAt, endsAt, msg.sender, isPublic);
    }

    /// @notice Add a candidate to an election
    function addCandidate(
        uint256 electionId,
        string memory name,
        string memory image
    ) external {
        Election storage election = elections[electionId];
        if (!election.exists) revert ElectionNotFound();
        if (election.owner != msg.sender) revert NotOwner();

        uint256 candidateId = electionCandidates[electionId].length + 1;
        electionCandidates[electionId].push(
            Candidate({id: candidateId, name: name, image: image, voteCount: 0})
        );
        emit CandidateAdded(electionId, candidateId, name, image);
    }

    function _isActive(Election memory election) internal view returns (bool) {
        uint64 now_ = uint64(block.timestamp);
        bool started = election.startsAt == 0 || now_ >= election.startsAt;
        bool notEnded = election.endsAt == 0 || now_ <= election.endsAt;
        return started && notEnded;
    }

    /// @notice Cast a vote with a Semaphore v4 ZK proof
    /// @param electionId The election to vote in
    /// @param candidateId The candidate to vote for (1-indexed)
    /// @param proof The Semaphore proof struct
    function castVote(
        uint256 electionId,
        uint256 candidateId,
        SemaphoreProof calldata proof
    ) external {
        Election memory election = elections[electionId];
        if (!election.exists) revert ElectionNotFound();
        if (!_isActive(election)) revert ElectionNotActive();
        if (nullifierUsed[proof.nullifier]) revert NullifierAlreadyUsed();
        if (candidateId == 0 || candidateId > electionCandidates[electionId].length) {
            revert InvalidCandidate();
        }

        // Verify the scope matches the election's external nullifier
        require(proof.scope == election.externalNullifier, "Invalid scope");
        
        // Verify the message matches the candidate ID
        require(proof.message == candidateId, "Message must match candidateId");

        // Semaphore v4: validateProof with struct
        semaphore.validateProof(election.groupId, proof);

        nullifierUsed[proof.nullifier] = true;
            electionCandidates[electionId][candidateId - 1].voteCount += 1;
        
        emit VoteCast(electionId, candidateId, proof.nullifier, proof.message);
    }

    /// @notice Get all candidates for an election
    function getCandidates(uint256 electionId) external view returns (Candidate[] memory) {
        return electionCandidates[electionId];
    }
    
    /// @notice Get vote count for a specific candidate
    function getVoteCount(uint256 electionId, uint256 candidateId) external view returns (uint256) {
        if (candidateId == 0 || candidateId > electionCandidates[electionId].length) {
            return 0;
        }
        return electionCandidates[electionId][candidateId - 1].voteCount;
    }
    
    /// @notice Check if election is public
    /// @param electionId The election ID to check
    /// @return Whether the election results are publicly viewable
    function isElectionPublic(uint256 electionId) external view returns (bool) {
        return elections[electionId].isPublic;
    }
}
