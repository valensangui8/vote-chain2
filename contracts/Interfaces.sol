// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Semaphore v4 proof struct
struct SemaphoreProof {
    uint256 merkleTreeDepth;
    uint256 merkleTreeRoot;
    uint256 nullifier;
    uint256 message;
    uint256 scope;
    uint256[8] points;
}

/// @notice Interface for Semaphore v4 contract
interface ISemaphore {
    /// @notice Creates a new group and returns the group ID
    /// @return groupId The ID of the created group
    function createGroup() external returns (uint256 groupId);
    
    /// @notice Creates a new group with a specific admin
    /// @param admin The admin address for the group
    /// @return groupId The ID of the created group
    function createGroup(address admin) external returns (uint256 groupId);
    
    /// @notice Adds a member to a group
    /// @param groupId The ID of the group
    /// @param identityCommitment The identity commitment to add
    function addMember(uint256 groupId, uint256 identityCommitment) external;
    
    /// @notice Validates a Semaphore v4 proof
    /// @param groupId The ID of the group
    /// @param proof The Semaphore proof struct containing all proof data
    function validateProof(uint256 groupId, SemaphoreProof calldata proof) external;
    
    /// @notice Returns the merkle tree root of a group
    function getMerkleTreeRoot(uint256 groupId) external view returns (uint256);
    
    /// @notice Returns the merkle tree depth of a group
    function getMerkleTreeDepth(uint256 groupId) external view returns (uint256);
    
    /// @notice Returns the merkle tree size (number of members) of a group
    function getMerkleTreeSize(uint256 groupId) external view returns (uint256);
    
    /// @notice Returns the current group counter
    function groupCounter() external view returns (uint256);
}

/// @notice Minimal interface for a Semaphore verifier contract (legacy, for reference)
interface ISemaphoreVerifier {
    function verifyProof(
        uint256 merkleTreeRoot,
        uint256 nullifierHash,
        uint256 signal,
        uint256 externalNullifier,
        uint256[8] calldata proof
    ) external view;
}
