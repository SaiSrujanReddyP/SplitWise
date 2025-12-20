# Testing Guide - Expense Sharing Application

## Prerequisites

- Node.js (v18+ recommended, v22 supported)
- MongoDB Atlas account (free tier works)
- npm

---

## 1. MongoDB Atlas Setup

### Step 1: Create Atlas Account
1. Go to https://www.mongodb.com/cloud/atlas
2. Sign up for free account

### Step 2: Create a Cluster
1. Click "Build a Database"
2. Choose "FREE" (M0 Sandbox)
3. Select cloud provider and region
4. Click "Create Cluster"

### Step 3: Create Database User
1. Go to "Database Access" → "Add New Database User"
2. Choose "Password" authentication
3. Enter username and password (save these!)
4. Set privileges: "Read and write to any database"

### Step 4: Configure Network Access
1. Go to "Network Access" → "Add IP Address"
2. Click "Allow Access from Anywhere" (for development)

### Step 5: Get Connection String
1. Go to "Database" → Click "Connect"
2. Choose "Connect your application"
3. Copy and modify the connection string:
   ```
   mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/expense-sharing?retryWrites=true&w=majority
   ```

---

## 2. Application Setup

### Install Dependencies

```bash
# Server
cd server
npm install

# Client
cd ../client
npm install

# CLI
cd ../cli
npm install
npm link
```

### Configure Server Environment

Create `server/.env`:
```env
PORT=5000
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/expense-sharing?retryWrites=true&w=majority
JWT_SECRET=my-super-secret-key-12345
```

### Configure Client Environment

Create `client/.env`:
```env
VITE_API_URL=http://localhost:5000/api
```

---

## 3. Start the Application

### Terminal 1 - Start Server
```bash
cd server
npm start
```
Expected: `Server running on port 5000` and `MongoDB connected`

### Terminal 2 - Start Client
```bash
cd client
npm run dev
```
Expected: Opens at http://localhost:3000

---

## 4. Frontend Testing

### 4.1 Authentication
- [ ] Navigate to http://localhost:3000
- [ ] Click "Get Started" → Sign up with test credentials
- [ ] Create multiple test users:
  - `alice@test.com` / `password123`
  - `bob@test.com` / `password123`
  - `charlie@test.com` / `password123`
- [ ] Logout and login to verify

### 4.2 Dashboard
- [ ] View balance summary cards (You Owe, Owed to You, Net Balance)
- [ ] Click "Add Expense" button → Modal opens
- [ ] View "Balance Details" section (combined view of all balances)
- [ ] View Recent Activity section
- [ ] View Your Groups section

### 4.3 Balance Details Modal
- [ ] Click the ℹ️ button next to any balance
- [ ] Modal shows total amount owed
- [ ] Modal shows list of related expenses with dates
- [ ] Expenses sorted by date (most recent first)
- [ ] "Go to Settlements" link works

### 4.4 Add Expense Modal (from Dashboard)

#### Group Expense
- [ ] Select a group from dropdown
- [ ] Enter description and amount
- [ ] Select date (can be past date)
- [ ] Choose split type and verify preview
- [ ] Submit and verify balance updates

#### Non-Group (Direct) Expense
- [ ] Leave group as "No group - select users manually"
- [ ] Search for users by name or email
- [ ] Select one or more users
- [ ] Enter description and amount
- [ ] Submit expense
- [ ] **Verify**: Balance appears in Dashboard for both users

### 4.5 Split Types Testing
- [ ] **Equal Split**: Add $90 expense with 3 people, verify $30 each
- [ ] **Exact Split**: Add $100 expense, specify exact amounts per person
- [ ] **Percentage Split**: Add $100 expense, specify percentages (must ≤ 100%)

### 4.6 Groups
- [ ] Create a group: "Trip to Paris"
- [ ] Add members by email
- [ ] View group details
- [ ] Add expense from group page
- [ ] View group balances
- [ ] View settlement suggestions

### 4.7 Settlements Page
- [ ] View "You Owe" section with Settle buttons
- [ ] View "Owed to You" section
- [ ] View "Suggested Settlements" (minimal transactions)
- [ ] View "Recent Settlements" history

#### Group Settlement
- [ ] Click Settle on a group-related balance
- [ ] Select the group from dropdown
- [ ] Enter amount and submit
- [ ] Verify balance reduces

#### Direct Settlement
- [ ] Click Settle on a direct (non-group) balance
- [ ] Select "Direct Settlement (no group)"
- [ ] Enter amount and submit
- [ ] Verify balance reduces

### 4.8 Activity Tracking
- [ ] Add an expense → Check Dashboard Recent Activity
- [ ] Settle a balance → Check Settlements Recent Settlements
- [ ] Verify activities show correct user, amount, date

---

## 5. CLI Testing

### 5.1 Setup

```bash
# Login and get token
expense-cli login -e alice@test.com -p password123

# Set the token (copy from output)
set EXPENSE_CLI_TOKEN=your_token_here
```

### 5.2 Test All Commands

```bash
# List groups (formatted table)
expense-cli groups

# View group details
expense-cli group <GROUP_ID>

# Create group
expense-cli create-group "Road Trip"

# Add member
expense-cli add-member -g <GROUP_ID> -e bob@test.com

# Add expenses (all split types)
expense-cli add-expense -g <GROUP_ID> -a 120 -d "Gas" -s equal
expense-cli add-expense -g <GROUP_ID> -a 100 -d "Food" -s exact -p "[{\"userId\":\"USER_ID\",\"amount\":60}]"
expense-cli add-expense -g <GROUP_ID> -a 200 -d "Hotel" -s percentage -p "[{\"userId\":\"USER_ID\",\"percentage\":40}]"

# View balances (formatted)
expense-cli balances

# View settlement suggestions
expense-cli settlements
expense-cli settlements -g <GROUP_ID>

# Settle
expense-cli settle -g <GROUP_ID> -t <CREDITOR_ID> -a 50

# View recent activity
expense-cli activity
expense-cli activity -l 20
```

### 5.3 Expected CLI Output

```
📁 Your Groups

┌────────────────────┬────────────────────────────┬──────────────────────────────┐
│ Name               │ ID                         │ Members                      │
├────────────────────┼────────────────────────────┼──────────────────────────────┤
│ Trip to Paris      │ 6748081a122bac69a8246938   │ Alice, Bob, Charlie          │
└────────────────────┴────────────────────────────┴──────────────────────────────┘

💰 Your Balances

┌──────────────┬─────────┐
│ You Owe      │ $50.00  │
├──────────────┼─────────┤
│ Owed to You  │ $120.00 │
├──────────────┼─────────┤
│ Net Balance  │ $70.00  │
└──────────────┴─────────┘

🔄 Settlement Suggestions

┌───┬─────────┬─────────┬─────────┐
│ # │ From    │ To      │ Amount  │
├───┼─────────┼─────────┼─────────┤
│ 1 │ Bob     │ Alice   │ $50.00  │
│ 2 │ Charlie │ Alice   │ $20.00  │
└───┴─────────┴─────────┴─────────┘

📋 Recent Activity

┌────────────┬─────────────────────────┬─────────┬────────────┐
│ Type       │ Description             │ User    │ Date       │
├────────────┼─────────────────────────┼─────────┼────────────┤
│ Expense    │ Dinner - $90.00         │ Alice   │ 12/21/2025 │
│ Settlement │ $50.00 to Alice         │ Bob     │ 12/21/2025 │
│ Expense    │ Gas - $120.00           │ Alice   │ 12/20/2025 │
└────────────┴─────────────────────────┴─────────┴────────────┘
```

---

## 6. API Testing (curl)

```bash
# Set token
set TOKEN=your_jwt_token

# Get balances (includes both group and direct)
curl http://localhost:5000/api/balances -H "Authorization: Bearer %TOKEN%"

# Get balance details with specific user
curl http://localhost:5000/api/balances/details/USER_ID -H "Authorization: Bearer %TOKEN%"

# Get settlement suggestions
curl http://localhost:5000/api/balances/settlements -H "Authorization: Bearer %TOKEN%"

# Get recent activities
curl http://localhost:5000/api/activities -H "Authorization: Bearer %TOKEN%"

# Search users
curl "http://localhost:5000/api/expenses/search-users?q=bob" -H "Authorization: Bearer %TOKEN%"

# Create direct (non-group) expense
curl -X POST http://localhost:5000/api/expenses ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -d "{\"description\":\"Coffee\",\"amount\":10,\"splitType\":\"equal\",\"participants\":[{\"userId\":\"OTHER_USER_ID\"}]}"

# Settle direct balance
curl -X POST http://localhost:5000/api/balances/settle ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -d "{\"groupId\":\"direct\",\"creditorId\":\"CREDITOR_ID\",\"amount\":5}"
```

---

## 7. Feature Verification

### 7.1 Balance Simplification
Test that mutual debts cancel out:
1. Alice pays $60 (Bob, Charlie split equal) → Bob owes Alice $20, Charlie owes Alice $20
2. Bob pays $30 (Alice, Charlie split equal) → Alice owes Bob $10, Charlie owes Bob $10
3. **Verify**: Bob owes Alice $10 (not $20), because $20 - $10 = $10

### 7.2 Settlement Algorithm
Test minimal transactions:
1. Create complex debts between 3+ users
2. Run `expense-cli settlements`
3. Verify the number of transactions is minimized

### 7.3 Direct (Non-Group) Balances
1. From Dashboard, click "Add Expense"
2. Leave group as "No group - select users manually"
3. Search and select a user
4. Add the expense
5. **Verify on payer's dashboard**: Shows "Owed to You" with the other user
6. **Verify on other user's dashboard**: Shows "You Owe" with the payer
7. Click ℹ️ to see expense details
8. Settle using "Direct Settlement" option

### 7.4 Activity Tracking
1. Add an expense → Activity logged as `expense_added`
2. Settle a balance → Activity logged as `settlement`
3. Check Dashboard → Recent Activity shows both
4. Check Settlements → Recent Settlements shows settlement

### 7.5 Balance Details Modal
1. Create several expenses with another user
2. On Dashboard, click ℹ️ next to their balance
3. Verify modal shows all related expenses
4. Verify sorted by date (most recent first)
5. Verify total matches the balance amount

---

## 8. Verify Data in MongoDB Compass

1. Open MongoDB Compass
2. Connect to your Atlas cluster
3. View `expense-sharing` database:
   - `users` - Registered users
   - `groups` - Groups with embedded balances
   - `expenses` - All expenses (with or without group)
   - `activities` - Activity log entries
   - `directbalances` - Non-group balances between users

---

## 9. Checklist Summary

| Feature | Frontend | CLI | API |
|---------|----------|-----|-----|
| User Signup/Login | [ ] | [ ] | [ ] |
| Create Group | [ ] | [ ] | [ ] |
| Add Members | [ ] | [ ] | [ ] |
| Equal Split | [ ] | [ ] | [ ] |
| Exact Split | [ ] | [ ] | [ ] |
| Percentage Split | [ ] | [ ] | [ ] |
| View Balances | [ ] | [ ] | [ ] |
| Settlement Suggestions | [ ] | [ ] | [ ] |
| Group Settlement | [ ] | [ ] | [ ] |
| Direct Settlement | [ ] | N/A | [ ] |
| Recent Activity | [ ] | [ ] | [ ] |
| Settlement History | [ ] | N/A | [ ] |
| User Search | [ ] | N/A | [ ] |
| Date Selection | [ ] | N/A | [ ] |
| Non-Group Expenses | [ ] | N/A | [ ] |
| Balance Details Modal | [ ] | N/A | [ ] |

---

## 10. Troubleshooting

| Issue | Solution |
|-------|----------|
| MongoDB connection error | Check Atlas connection string, username/password, IP whitelist |
| CORS error | Ensure server is running on port 5000 |
| 401 Unauthorized | Token expired - login again |
| CLI command not found | Run `npm link` in cli folder |
| CLI colors not showing | Use Windows Terminal or PowerShell 7+ |
| Direct balances not showing | Restart server to load DirectBalance model |
| User search returns empty | Query must be at least 2 characters |
| Settlement fails | Check if settling group balance in correct group, or use "direct" for non-group |
| Balance details empty | Expenses must involve both users (payer and participant) |
