// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Interfaces.sol";

/// @title GroupManager
/// @notice Manages Semaphore groups for elections using Semaphore v4
contract GroupManager {
    event ElectionGroupRegistered(uint256 indexed electionId, uint256 indexed groupId, uint256 externalNullifier);
    event VoterCommitmentAdded(uint256 indexed electionId, uint256 indexed groupId, uint256 identityCommitment);

    error ElectionAlreadyRegistered();
    error NotRegistered();

    struct GroupMeta {
        uint256 groupId;
        uint256 externalNullifier;
    }

    mapping(uint256 => GroupMeta) public electionGroups;

    ISemaphore public immutable semaphore;

    constructor(address semaphoreAddress) {
        semaphore = ISemaphore(semaphoreAddress);
    }

    /// @notice Register a new election group
    /// @param electionId The election ID (from your system)
    /// @param externalNullifier A unique value for this election (used as scope in proofs)
    /// @return groupId The Semaphore group ID that was created
    function registerElectionGroup(
        uint256 electionId,
        uint256 externalNullifier
    ) external returns (uint256 groupId) {
        if (electionGroups[electionId].groupId != 0) {
            revert ElectionAlreadyRegistered();
        }
        
        // Semaphore v4: createGroup() returns the new groupId
        // The caller (this contract) becomes the admin
        groupId = semaphore.createGroup();
        
        electionGroups[electionId] = GroupMeta(groupId, externalNullifier);
        emit ElectionGroupRegistered(electionId, groupId, externalNullifier);
        
        return groupId;
    }

    /// @notice Add a voter's commitment to an election's group
    /// @param electionId The election ID
    /// @param identityCommitment The voter's identity commitment
    function addCommitment(
        uint256 electionId,
        uint256 identityCommitment
    ) external {
        GroupMeta memory meta = electionGroups[electionId];
        if (meta.groupId == 0) revert NotRegistered();
        
        semaphore.addMember(meta.groupId, identityCommitment);
        emit VoterCommitmentAdded(electionId, meta.groupId, identityCommitment);
    }

    /// @notice Get the Semaphore group ID for an election
    function getGroupId(uint256 electionId) external view returns (uint256) {
        return electionGroups[electionId].groupId;
    }
    
    /// @notice Get the external nullifier (scope) for an election
    function getExternalNullifier(uint256 electionId) external view returns (uint256) {
        return electionGroups[electionId].externalNullifier;
    }
}
