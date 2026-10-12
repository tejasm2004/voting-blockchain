# Decentralized Voting System on Ethereum Blockchain

A modern, transparent, and tamper-proof **Decentralized Voting System** powered by Ethereum smart contracts, Python FastAPI backend, and an intuitive web interface. Built for universities, student councils, corporate boards, clubs, and civic organizations seeking cryptographic election integrity without intermediaries.

---

## 🌟 Key Features

* **⛓️ Immutable Ethereum Smart Contract:** Every ballot cast is permanently mined into a block on the local EVM blockchain (`Voting.sol`). Once cast, votes cannot be modified, deleted, or manipulated by anyone (not even the election administrator).
* **🔒 Sequential 3-Step Setup Workflow:**
  1. **Add Candidates:** Register candidate details including **First Name**, **Last Name**, **Phone Number**, **Location**, **Category/Party**, **Bio**, and **Camera Snapshot or Photo Upload** with live SHA-256 fingerprint generation.
  2. **Upload Voters List:** Import an eligible voters roster directly from an Excel (`.xlsx`, `.xls`) or CSV sheet with built-in schema validation and sample template download.
  3. **Customizable Timer:** Configure the voting window in **Days**, **Hours**, **Minutes**, and **Seconds** (with quick-select presets like *1 Min*, *5 Mins*, *1 Hour*).
* **🛡️ Consensus Lockout:** Once the voting window becomes active, candidate nominations and the voters database are strictly locked on both the blockchain and the backend to prevent mid-election alterations.
* **📷 Biometric Voter Verification:**
  * Citizen enrollment only unlocks after all 3 setup prerequisites are fulfilled.
  * Captures a live webcam snapshot during voter verification and calculates an SHA-256 cryptographic hash.
  * Ballot cards display each candidate's real captured photo, category, and location.
* **🗳️ Secret Ballots (Zero Bandwagon Bias):** Live vote counts and percentages remain completely hidden during the active voting window so voters cannot be swayed.
* **🏆 Certified Results & Audit Trail:**
  * When time expires, polls automatically conclude.
  * Displays 1st Position (**Green**) and 2nd Position (**Yellow**) without emojis, plus a full candidate rankings breakdown.
  * **CSV Audit Export:** Download complete voter records with verification timestamps, SHA-256 image hashes, and photo URLs in a clean `.csv` file.
  * **Cycle Reset:** Admin can wipe candidate nominations on-chain and reset for a fresh election round with one click.

---

## 🛠️ Tech Stack & Architecture

| Layer | Technologies Used |
|---|---|
| **Blockchain / Smart Contract** | Solidity (`^0.5.15`), Truffle Suite, Ganache (Local EVM) |
| **Web3 Client** | Web3.js (`^1.9.0`), `@truffle/contract`, Browserify |
| **Backend API & Database** | Python 3.11, FastAPI, SQLite3 (Zero setup), Uvicorn, PyJWT |
| **Frontend UI** | HTML5, CSS3, JavaScript, SheetJS (`xlsx`) for client-side Excel parsing |
| **Application Server** | Node.js, Express.js (Port `8080`) |

---

## 📋 Prerequisites & Software Required

Before running the project from scratch, make sure the following software is installed on your computer:

1. **[Node.js](https://nodejs.org/)** (v18.x or v20.x LTS)
2. **[Python](https://www.python.org/downloads/)** (v3.9 to v3.11) - *Make sure "Add Python to PATH" is checked during installation.*
3. **[Ganache](https://trufflesuite.com/ganache/)** (Desktop GUI or CLI)
4. **[Visual Studio Code](https://code.visualstudio.com/)**
5. **[Git](https://git-scm.com/)**

---

## 🚀 Step-by-Step Guide to Run in VS Code from Scratch

### Step 1: Open Project in VS Code
1. Open Visual Studio Code.
2. Select **File ➔ Open Folder...** and choose this project directory:
   ```text
   voting-blockchain
   ```
3. Open a terminal in VS Code using the shortcut:  
   ``Ctrl + ` `` (Backtick) or via menu **Terminal ➔ New Terminal**.

---

### Step 2: Install Node.js Dependencies
In your VS Code terminal, install the required npm packages:
```powershell
npm install
```
*(This installs Web3, Truffle contracts, Express, Browserify, and required build tools.)*

---

### Step 3: Install Python Dependencies
Install the required backend packages using `pip`:
```powershell
pip install -r requirements.txt
```
*Dependencies installed:*
* `fastapi` - High-performance backend API
* `uvicorn[standard]` - ASGI server
* `pydantic` - Data modeling and validation
* `python-dotenv` - Environment variable loading
* `PyJWT` - Secure token creation

*(Note: SQLite comes built into Python, so no external database installation or MySQL server configuration is needed!)*

---

### Step 4: Start Local Blockchain (Ganache)
You can run Ganache in either of the two following ways:

#### Option A: Using Ganache Desktop GUI (Recommended for Visual Viva / Demos)
1. Open the **Ganache** desktop application.
2. Click **Quickstart Ethereum**.
3. Confirm the RPC Server is running on:
   ```text
   HTTP://127.0.0.1:7545
   Network ID: 5777
   ```

#### Option B: Using Ganache CLI in VS Code
Open a new terminal tab in VS Code and run:
```powershell
npx ganache --port 7545 --networkId 5777 --wallet.deterministic
```
*(Leave this terminal running in the background).*

---

### Step 5: Compile & Deploy Smart Contracts
Open a new terminal tab in VS Code and run:
```powershell
npx truffle compile
npx truffle migrate --reset
```
*Expected Output:*
* `Voting` smart contract compiles successfully.
* Deployment completes on the `development` network (Port `7545`).
* Artifacts are saved to `build/contracts/Voting.json`.

*(Optional)* If you make edits to `src/js/app.js`, rebuild the browser bundle:
```powershell
npx browserify src/js/app.js -o src/dist/app.bundle.js
```

---

### Step 6: Start Python FastAPI Backend Server
Open another terminal tab in VS Code, navigate to `Database_API`, and start Uvicorn:
```powershell
cd Database_API
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```
* The backend API will be live at: `http://127.0.0.1:8000`
* Interactive API documentation: `http://127.0.0.1:8000/docs`

---

### Step 7: Start Express Frontend Server
Open a final terminal tab in VS Code and start the web server from the project root:
```powershell
node index.js
```
* The voting web portal will be accessible at: **`http://localhost:8080`**

---

### ⚡ Alternative: One-Click Launch (PowerShell)
If you prefer to start all services simultaneously with a single script, run in PowerShell:
```powershell
.\run.ps1
```

---

## 🖥️ End-to-End Walkthrough & Usage

### 1. Admin Login & Setup Mode
1. Open your browser and navigate to **`http://localhost:8080`**.
2. Select **Administrator / Authority** and log in:
   * **Username / Voter ID:** `admin`
   * **Password:** `admin123`
3. You will be redirected to the **Admin Dashboard** (`admin.html`).

### 2. Follow the 3-Step Setup Workflow
* **Step 1: Add Candidates**
  * Enter Candidate First Name, Last Name, Phone Number, Location, and Category/Party.
  * Click **📷 Open Camera** to capture a live webcam photo (or **📁 Upload Photo** from disk).
  * Click **➕ Register Candidate**. The candidate is sealed on the Ethereum blockchain and in the backend.
* **Step 2: Upload Voters List**
  * Click **Download Sample Template** to inspect the required format (`Unique_ID`, `Full_Name`, `Locality`).
  * Drag and drop your `.xlsx` or `.csv` spreadsheet and click **Upload Voters List**.
* **Step 3: Set Timer & Launch Election**
  * Pick a duration (e.g., click **5 Mins** or enter custom hours/mins/secs).
  * Click **💾 Broadcast Timeline & Start Polls**.
  * The countdown timer starts immediately, and admin controls are locked.

### 3. Voter Portal & Voting Flow
1. Open **`http://localhost:8080/index.html`** (or log out from admin).
2. Because all 3 prerequisites are met, the **Citizen Enrollment** portal appears.
3. Allow camera access.
4. Enter the voter's **Full Name** and **Voter ID Number** (e.g. from the uploaded roster).
5. Click **📷 Capture Photo & Proceed to Vote**.
   * A snapshot is taken, hashed with SHA-256, and verified against the eligible roster.
6. Select your preferred candidate from the ballot cards (which display their real captured photo and location).
7. Click **Vote for Candidate**.
8. A popup shows the official **Transaction Hash** and **Block Number** mined on the blockchain.

### 4. Viewing Results & Exporting Data
1. When the countdown reaches `00:00:00`, the election status changes to **POLLS CONCLUDED**.
2. Visit the admin page to see:
   * **1st Position (Highest Votes):** Highlighted in **Green**.
   * **2nd Position (Runner-up):** Highlighted in **Yellow**.
   * Complete verified standings table.
3. Click **📥 Download Voters & Photos (.csv)** to download a complete `.csv` audit file containing Voter ID, Name, Verification Status, Photo URL, SHA-256 Hash, and Timestamps.
4. Click **🔄 Start New Election** to wipe candidates and start a new round.

---

## 🔍 What to Demonstrate in Ganache (Viva / Project Evaluation)

When evaluators ask to see proof of the blockchain:
1. **Header Bar:** Show `CURRENT BLOCK` count, RPC Server (`127.0.0.1:7545`), and Network ID (`5777`).
2. **`TRANSACTIONS` Tab:** Point to the mined transactions. Match the **TX HASH** on the screen with the receipt generated when a vote was cast. Show that calls go to the smart contract address.
3. **`BLOCKS` Tab:** Click on the latest block to show the **Block Hash**, **Parent Hash**, and transaction payload, demonstrating the tamper-proof ledger.
4. **`ACCOUNTS` Tab:** Point out that voter accounts spend a fraction of test ETH to pay gas fees for executing `vote()`.

---

## 📁 Repository Structure

```text
├── contracts/
│   ├── Voting.sol              # Core Ethereum voting contract (Candidates, Votes, Rounds, Reset)
│   ├── Migrations.sol          # Truffle deployment migration tracker
│   └── 2_deploy_contracts.js   # Migration deployment configuration
├── Database_API/
│   ├── captured_photos/        # Directory storing captured voter and candidate snapshots
│   ├── main.py                 # FastAPI backend (Auth, SQLite storage, SHA-256 hashing, CSV export)
│   ├── requirements.txt        # Python backend dependencies
│   └── voter_db.sqlite         # SQLite database containing voter lists & audit logs
├── migrations/
│   ├── 1_initial_migration.js  # Truffle migration step 1
│   └── 2_deploy_contracts.js   # Truffle migration step 2
├── public/                     # Static assets and icons
├── src/
│   ├── css/                    # Stylesheets (style_major.css, admin.css, login.css)
│   ├── dist/
│   │   └── app.bundle.js       # Browserified Web3 frontend bundle
│   ├── html/
│   │   ├── admin.html          # Administrator setup, timer, candidate manager & certified results
│   │   ├── index.html          # Voter portal, biometric camera check & secret ballot
│   │   └── login.html          # Initial entry portal
│   └── js/
│       ├── app.js              # Web3, contract communication, camera handlers & voter verification
│       └── login.js            # Login authentication router
├── index.js                    # Node.js Express server & Ganache status query
├── package.json                # Node dependencies & project metadata
├── requirements.txt            # Python dependencies (root)
├── run.ps1                     # One-click startup PowerShell script
├── truffle-config.js           # Truffle compiler & Ganache network configuration
└── README.md                   # Comprehensive project documentation
```

---

## 📄 License
This project is licensed under the **MIT License**.
