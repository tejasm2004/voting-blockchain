pragma solidity ^0.5.15;

contract Voting {
    address public admin;
    string public electionTitle = "2026 Sovereign Decentralized General Election";
    string public electionDescription = "Ethereum Mainnet Enterprise Protocol for Verifiable, Zero-Knowledge Democratic Balloting";

    enum ElectionState { SETUP, ACTIVE, CONCLUDED }
    ElectionState public state = ElectionState.SETUP;

    struct Candidate {
        uint id;
        string name;
        string party;
        string manifesto;
        uint voteCount;
    }

    struct VoterReceipt {
        bool hasVoted;
        uint candidateId;
        uint timestamp;
    }

    mapping (uint => Candidate) public candidates;
    mapping (address => VoterReceipt) public voterReceipts;
    uint public electionRound = 1;
    mapping (uint => mapping(address => VoterReceipt)) public roundVoterReceipts;

    uint public countCandidates;
    uint public totalVotes;
    uint256 public votingStart;
    uint256 public votingEnd;

    event CandidateAdded(uint indexed id, string name, string party, string manifesto);
    event Voted(address indexed voter, uint indexed candidateId, uint timestamp);
    event DatesUpdated(uint256 startDate, uint256 endDate);
    event StateChanged(ElectionState newState, uint timestamp);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Restricted: Only election authority can execute");
        _;
    }

    constructor() public {
        admin = msg.sender;
    }

    function addCandidate(string memory name, string memory party, string memory manifesto) public returns(uint) {
        require(bytes(name).length > 0, "Candidate name is required");
        countCandidates++;
        candidates[countCandidates] = Candidate(countCandidates, name, party, manifesto, 0);
        emit CandidateAdded(countCandidates, name, party, manifesto);
        return countCandidates;
    }

    // Overload for backward compatibility with existing scripts
    function addCandidate(string memory name, string memory party) public returns(uint) {
        return addCandidate(name, party, "Official Platform & Public Manifesto on Blockchain");
    }

    function setElectionMetadata(string memory _title, string memory _desc) public {
        electionTitle = _title;
        electionDescription = _desc;
    }

    function startElection() public {
        state = ElectionState.ACTIVE;
        if (votingStart == 0) {
            votingStart = now;
            votingEnd = now + 7 days;
        }
        emit StateChanged(state, now);
    }

    function endElection() public {
        state = ElectionState.CONCLUDED;
        votingEnd = now;
        emit StateChanged(state, now);
    }

    function resetElection() public {
        state = ElectionState.SETUP;
        votingStart = 0;
        votingEnd = 0;
        for (uint i = 1; i <= countCandidates; i++) {
            delete candidates[i];
        }
        countCandidates = 0;
        totalVotes = 0;
        electionRound++;
        emit StateChanged(state, now);
    }

    function setDates(uint256 _startDate, uint256 _endDate) public {
        require(_endDate > _startDate, "End date must succeed start date");
        votingStart = _startDate;
        votingEnd = _endDate;
        if (now >= _startDate && now <= _endDate) {
            state = ElectionState.ACTIVE;
        } else if (now > _endDate) {
            state = ElectionState.CONCLUDED;
        } else {
            state = ElectionState.SETUP;
        }
        emit DatesUpdated(_startDate, _endDate);
    }

    function vote(uint candidateID) public {
        // Enforce state & timeline
        if (votingStart > 0 && votingEnd > 0) {
            require(now >= votingStart, "Voting window has not opened");
            require(now <= votingEnd, "Voting window has closed");
        }
        if (state == ElectionState.CONCLUDED) {
            revert("Election is officially concluded");
        }

        require(candidateID > 0 && candidateID <= countCandidates, "Invalid candidate selection");
        require(!roundVoterReceipts[electionRound][msg.sender].hasVoted, "Cryptographic address has already cast a ballot in this round");

        roundVoterReceipts[electionRound][msg.sender] = VoterReceipt(true, candidateID, now);
        voterReceipts[msg.sender] = VoterReceipt(true, candidateID, now);
        candidates[candidateID].voteCount++;
        totalVotes++;

        emit Voted(msg.sender, candidateID, now);
    }

    function checkVote() public view returns(bool) {
        return roundVoterReceipts[electionRound][msg.sender].hasVoted;
    }

    function getVoterReceipt(address _voter) public view returns(bool, uint, uint) {
        VoterReceipt memory r = roundVoterReceipts[electionRound][_voter];
        return (r.hasVoted, r.candidateId, r.timestamp);
    }

    function getCountCandidates() public view returns(uint) {
        return countCandidates;
    }

    function getCandidate(uint candidateID) public view returns (uint, string memory, string memory, string memory, uint) {
        Candidate memory c = candidates[candidateID];
        return (c.id, c.name, c.party, c.manifesto, c.voteCount);
    }

    function getDates() public view returns (uint256, uint256) {
        return (votingStart, votingEnd);
    }

    function getElectionStatus() public view returns (string memory) {
        if (state == ElectionState.CONCLUDED || (votingEnd > 0 && now > votingEnd)) {
            return "CONCLUDED";
        } else if (state == ElectionState.ACTIVE || (votingStart > 0 && now >= votingStart && now <= votingEnd)) {
            return "ACTIVE";
        } else if (votingStart > 0 && now < votingStart) {
            return "UPCOMING";
        } else {
            return "SETUP";
        }
    }
}
