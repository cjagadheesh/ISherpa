// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SEBIDocumentRegistry
 * @notice Immutable on-chain registry for SEBI SME IPO document hashes.
 *         Deploy on Polygon Amoy Testnet (free) or Polygon Mainnet.
 *
 * @dev Architecture: Off-chain storage + On-chain anchoring.
 *      Only SHA-256 hashes are stored — no private data ever touches the chain.
 *      This provides tamper-proof "proof of existence" for:
 *        - Uploaded compliance documents (financials, GST, incorporation, compliance)
 *        - Generated Draft Prospectus (.docx)
 *        - Compliance audit log snapshots
 */
contract SEBIDocumentRegistry {

    // ── Structs ─────────────────────────────────────────────────────────────

    struct DocumentRecord {
        bytes32 docHash;       // SHA-256 of the document file
        string  docType;       // "financials" | "gst" | "incorporation" | "compliance"
        string  sessionId;     // Application session identifier
        uint256 anchoredAt;    // block.timestamp when anchored
        address submitter;     // wallet that submitted the tx
        bool    exists;        // sentinel to distinguish zero-hash from missing
    }

    struct ProspectusRecord {
        bytes32 draftHash;     // SHA-256 of the generated .docx file
        string  sessionId;
        string  companyName;
        uint256 sealedAt;
        address submitter;
        bool    exists;
    }

    struct AuditEntry {
        string  sessionId;
        bytes32 snapshotHash;  // SHA-256 of session_state.json at validation time
        uint8   checksRun;     // number of ICDR checks executed
        uint8   checksPassed;  // number of checks that passed
        uint256 loggedAt;
        address submitter;
    }

    // ── State ────────────────────────────────────────────────────────────────

    address public owner;

    // docHash → DocumentRecord
    mapping(bytes32 => DocumentRecord) private _documents;

    // draftHash → ProspectusRecord
    mapping(bytes32 => ProspectusRecord) private _prospectuses;

    // sessionId → AuditEntry[]
    mapping(string => AuditEntry[]) private _auditLog;

    // All anchored document hashes (for enumeration)
    bytes32[] public allDocumentHashes;

    // All sealed prospectus hashes
    bytes32[] public allProspectusHashes;

    // ── Events ───────────────────────────────────────────────────────────────

    event DocumentAnchored(
        bytes32 indexed docHash,
        string  docType,
        string  sessionId,
        uint256 anchoredAt
    );

    event ProspectusSealed(
        bytes32 indexed draftHash,
        string  companyName,
        string  sessionId,
        uint256 sealedAt
    );

    event AuditLogAdded(
        string  indexed sessionId,
        bytes32 snapshotHash,
        uint8   checksRun,
        uint8   checksPassed,
        uint256 loggedAt
    );

    // ── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "SEBIRegistry: caller is not owner");
        _;
    }

    // ── Constructor ──────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
    }

    // ── Write Functions ──────────────────────────────────────────────────────

    /**
     * @notice Anchor a compliance document hash on-chain.
     * @param _docHash  SHA-256 hash of the uploaded document (as bytes32)
     * @param _docType  Document category: "financials", "gst", "incorporation", "compliance"
     * @param _sessionId  Application session ID
     */
    function anchorDocument(
        bytes32 _docHash,
        string calldata _docType,
        string calldata _sessionId
    ) external {
        require(_docHash != bytes32(0), "SEBIRegistry: hash cannot be zero");
        require(!_documents[_docHash].exists, "SEBIRegistry: document already anchored");

        _documents[_docHash] = DocumentRecord({
            docHash:    _docHash,
            docType:    _docType,
            sessionId:  _sessionId,
            anchoredAt: block.timestamp,
            submitter:  msg.sender,
            exists:     true
        });

        allDocumentHashes.push(_docHash);

        emit DocumentAnchored(_docHash, _docType, _sessionId, block.timestamp);
    }

    /**
     * @notice Seal a generated Draft Prospectus on-chain.
     * @param _draftHash   SHA-256 hash of the .docx file
     * @param _sessionId   Application session ID
     * @param _companyName Company name for human-readable event logs
     */
    function sealProspectus(
        bytes32 _draftHash,
        string calldata _sessionId,
        string calldata _companyName
    ) external {
        require(_draftHash != bytes32(0), "SEBIRegistry: hash cannot be zero");
        require(!_prospectuses[_draftHash].exists, "SEBIRegistry: prospectus already sealed");

        _prospectuses[_draftHash] = ProspectusRecord({
            draftHash:   _draftHash,
            sessionId:   _sessionId,
            companyName: _companyName,
            sealedAt:    block.timestamp,
            submitter:   msg.sender,
            exists:      true
        });

        allProspectusHashes.push(_draftHash);

        emit ProspectusSealed(_draftHash, _companyName, _sessionId, block.timestamp);
    }

    /**
     * @notice Append a compliance check audit entry for a session.
     * @param _sessionId    Application session ID
     * @param _snapshotHash SHA-256 of session_state.json at time of validation
     * @param _checksRun    Total ICDR checks executed
     * @param _checksPassed Checks that passed without flags
     */
    function logAudit(
        string calldata _sessionId,
        bytes32 _snapshotHash,
        uint8 _checksRun,
        uint8 _checksPassed
    ) external {
        _auditLog[_sessionId].push(AuditEntry({
            sessionId:    _sessionId,
            snapshotHash: _snapshotHash,
            checksRun:    _checksRun,
            checksPassed: _checksPassed,
            loggedAt:     block.timestamp,
            submitter:    msg.sender
        }));

        emit AuditLogAdded(_sessionId, _snapshotHash, _checksRun, _checksPassed, block.timestamp);
    }

    // ── Read / Verify Functions ──────────────────────────────────────────────

    /**
     * @notice Verify a document hash exists on-chain and return its metadata.
     * @return exists      true if the hash was previously anchored
     * @return anchoredAt  Unix timestamp of anchoring (0 if not found)
     * @return docType     Document category string
     * @return sessionId   Session ID at time of anchoring
     */
    function verifyDocument(bytes32 _docHash)
        external view
        returns (bool exists, uint256 anchoredAt, string memory docType, string memory sessionId)
    {
        DocumentRecord memory r = _documents[_docHash];
        return (r.exists, r.anchoredAt, r.docType, r.sessionId);
    }

    /**
     * @notice Verify a prospectus hash.
     * @return exists      true if the prospectus was previously sealed
     * @return sealedAt    Unix timestamp of sealing
     * @return companyName Company name registered at seal time
     */
    function verifyProspectus(bytes32 _draftHash)
        external view
        returns (bool exists, uint256 sealedAt, string memory companyName)
    {
        ProspectusRecord memory r = _prospectuses[_draftHash];
        return (r.exists, r.sealedAt, r.companyName);
    }

    /**
     * @notice Get all audit log entries for a session.
     */
    function getAuditLog(string calldata _sessionId)
        external view
        returns (AuditEntry[] memory)
    {
        return _auditLog[_sessionId];
    }

    /**
     * @notice Get total number of anchored documents.
     */
    function totalDocuments() external view returns (uint256) {
        return allDocumentHashes.length;
    }

    /**
     * @notice Get total number of sealed prospectuses.
     */
    function totalProspectuses() external view returns (uint256) {
        return allProspectusHashes.length;
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    /**
     * @notice Transfer contract ownership to a new address.
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "SEBIRegistry: zero address");
        owner = _newOwner;
    }
}
