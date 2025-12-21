# Testing Guide - Expense Sharing Application

## Prerequisites

- Node.js (v18+ recommended, v22 supported)
- MongoDB Atlas account (free tier works)
- Redis (optional but recommended for production)
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

## 2. Redis Setup (Optional but Recommended)

### Option A: Local Redis (Docker)
```bash
docker run -d -p 6379:6379 --name redis redis
```

### Option B: Redis Cloud (Free Tier)
1. Go to https://redis.com/try-free/
2. Create a free database
3. Copy the connection string

### Option C: Skip Redis
The application works without Redis but with reduced performance:
- No caching (every request hits MongoDB)
- In-memory locks only (single instance)

---

## 3. Application Setup

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
NODE_ENV=development
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/expense-sharing?retryWrites=true&w=majority
JWT_SECRET=my-super-secret-key-12345

# Optional: Redis for caching and distributed locks
REDIS_URL=redis://localhost:6379

# Use new scalable balance service
USE_BALANCE_V2=true
```

### Configure Client Environment

Create `client/.env`:
```env
VITE_API_URL=http://localhost:5000/api
```

---

## 4. Start the Application

### Terminal 1 - Start Server
```bash
cd server
npm start
```
Expected output:
```
✅ MongoDB connected
⚠️  REDIS_URL not set - running without cache (not recommended for production)
✅ Job queues initialized
🚀 Server running on port 5000
📊 Health check: http://localhost:5000/health
```

With Redis:
```
✅ MongoDB connected
✅ Redis connected
✅ Distributed lock manager initialized
✅ Job queues initialized
🚀 Server running on port 5000
```

### Terminal 2 - Start Client
```bash
cd client
npm run dev
```
Expected: Opens at http://localhost:5173

---

## 5. Health Check

```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-12-21T10:30:00.000Z",
  "services": {
    "redis": "connected",
    "locks": 0
  },
  "queues": {
    "activities": { "processed": 0, "failed": 0, "pending": 0 },
    "balances": { "processed": 0, "failed": 0, "pending": 0 }
  }
}
```

---

## 6. Frontend Testing

### 6.1 Authentication
- [ ] Navigate to http://localhost:5173
- [ ] Click "Get Started" → Sign up with test credentials
- [ ] Create multiple test users:
  - `alice@test.com` / `password123`
  - `bob@test.com` / `password123`
  - `charlie@test.com` / `password123`
- [ ] Logout and login to verify

### 6.2 Dashboard
- [ ] View balance summary cards (You Owe, Owed to You, Net Balance)
- [ ] Click "Add Expense" button → Modal opens
- [ ] View "Balance Details" section (combined view of all balances)
- [ ] View Recent Activity section
- [ ] View Your Groups section

### 6.3 Balance Details Modal
- [ ] Click the ℹ️ button next to any balance
- [ ] Modal shows total amount owed
- [ ] Modal shows list of related expenses with dates
- [ ] Expenses sorted by date (most recent first)
- [ ] "Go to Settlements" link works

### 6.4 Add Expense Modal (from Dashboard)

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

### 6.5 Split Types Testing
- [ ] **Equal Split**: Add $90 expense with 3 people, verify $30 each
- [ ] **Exact Split**: Add $100 expense, specify exact amounts per person
- [ ] **Percentage Split**: Add $100 expense, specify percentages (must ≤ 100%)

### 6.6 Groups
- [ ] Create a group: "Trip to Paris"
- [ ] Add members by email
- [ ] View group details
- [ ] Add expense from group page
- [ ] View group balances
- [ ] View settlement suggestions

### 6.7 Settlements Page
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

### 6.8 Pagination Testing
- [ ] Create 25+ expenses in a group
- [ ] Verify expenses load in pages
- [ ] Scroll to load more (if infinite scroll implemented)
- [ ] Or click "Load More" / pagination controls

---

## 7. CLI Testing

### 7.1 Setup

```bash
# Login and get token
expense-cli login -e alice@test.com -p password123

# Set the token (copy from output)
set EXPENSE_CLI_TOKEN=your_token_here
```

### 7.2 Test All Commands

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

---

## 8. Scalability Testing

### 8.1 Rate Limiting
```bash
# Test rate limiting (should get 429 after ~100 requests)
for i in {1..120}; do curl -s http://localhost:5000/api/groups -H "Authorization: Bearer $TOKEN" & done
```

### 8.2 Caching (requires Redis)
```bash
# First request (cache miss)
time curl http://localhost:5000/api/balances -H "Authorization: Bearer $TOKEN"

# Second request (cache hit - should be faster)
time curl http://localhost:5000/api/balances -H "Authorization: Bearer $TOKEN"
```

### 8.3 Health Check Monitoring
```bash
# Watch queue stats
watch -n 1 'curl -s http://localhost:5000/health | jq'
```

### 8.4 Pagination
```bash
# Get first page
curl "http://localhost:5000/api/expenses/mine?limit=10" -H "Authorization: Bearer $TOKEN"

# Get next page using cursor
curl "http://localhost:5000/api/expenses/mine?limit=10&cursor=CURSOR_FROM_RESPONSE" -H "Authorization: Bearer $TOKEN"
```

---

## 9. API Testing (curl)

```bash
# Set token
set TOKEN=your_jwt_token

# Get balances (includes both group and direct)
curl http://localhost:5000/api/balances -H "Authorization: Bearer %TOKEN%"

# Get balance details with specific user
curl http://localhost:5000/api/balances/details/USER_ID -H "Authorization: Bearer %TOKEN%"

# Get settlement suggestions
curl http://localhost:5000/api/balances/settlements -H "Authorization: Bearer %TOKEN%"

# Get recent activities (paginated)
curl "http://localhost:5000/api/activities?limit=10" -H "Authorization: Bearer %TOKEN%"

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

## 10. Feature Verification

### 10.1 Balance Simplification
Test that mutual debts cancel out:
1. Alice pays $60 (Bob, Charlie split equal) → Bob owes Alice $20, Charlie owes Alice $20
2. Bob pays $30 (Alice, Charlie split equal) → Alice owes Bob $10, Charlie owes Bob $10
3. **Verify**: Bob owes Alice $10 (not $20), because $20 - $10 = $10

### 10.2 Settlement Algorithm
Test minimal transactions:
1. Create complex debts between 3+ users
2. Run `expense-cli settlements`
3. Verify the number of transactions is minimized

### 10.3 Direct (Non-Group) Balances
1. From Dashboard, click "Add Expense"
2. Leave group as "No group - select users manually"
3. Search and select a user
4. Add the expense
5. **Verify on payer's dashboard**: Shows "Owed to You" with the other user
6. **Verify on other user's dashboard**: Shows "You Owe" with the payer
7. Click ℹ️ to see expense details
8. Settle using "Direct Settlement" option

### 10.4 Caching Verification (with Redis)
1. Make a request to `/api/balances`
2. Check Redis: `redis-cli GET "balances:user:USER_ID"`
3. Make same request again (should be faster)
4. Add an expense
5. Check Redis again (cache should be invalidated)

### 10.5 Background Jobs
1. Add an expense
2. Check health endpoint for queue stats
3. Verify `activities.processed` increased

---

## 11. Verify Data in MongoDB Compass

1. Open MongoDB Compass
2. Connect to your Atlas cluster
3. View `expense-sharing` database:
   - `users` - Registered users
   - `groups` - Groups with members
   - `expenses` - All expenses (with indexes)
   - `activities` - Activity log entries
   - `balances` - NEW: Scalable balance storage
   - `directbalances` - Legacy (if USE_BALANCE_V2=false)

### Check Indexes
```javascript
// In MongoDB Compass, run:
db.expenses.getIndexes()
db.activities.getIndexes()
db.balances.getIndexes()
```

---

## 12. Checklist Summary

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
| Pagination | [ ] | N/A | [ ] |
| Rate Limiting | N/A | N/A | [ ] |
| Caching (Redis) | N/A | N/A | [ ] |
| Health Check | N/A | N/A | [ ] |

---

## 13. Troubleshooting

| Issue | Solution |
|-------|----------|
| MongoDB connection error | Check Atlas connection string, username/password, IP whitelist |
| Redis connection error | Check REDIS_URL, ensure Redis is running |
| CORS error | Ensure server is running on port 5000 |
| 401 Unauthorized | Token expired - login again |
| 429 Too Many Requests | Rate limited - wait 1 minute |
| CLI command not found | Run `npm link` in cli folder |
| CLI colors not showing | Use Windows Terminal or PowerShell 7+ |
| Balances not updating | Check if USE_BALANCE_V2=true in .env |
| Cache not working | Check Redis connection in health endpoint |
| Slow requests | Check if Redis is connected (caching disabled without it) |
| User search returns empty | Query must be at least 2 characters |
| Settlement fails | Check if settling group balance in correct group |

---

## 14. Performance Benchmarks

Expected performance with Redis caching:

| Operation | Without Cache | With Cache |
|-----------|--------------|------------|
| Get user balances | ~50ms | ~5ms |
| Get group balances | ~30ms | ~3ms |
| List expenses (20) | ~80ms | ~80ms |
| Add expense | ~100ms | ~100ms |
| Health check | ~5ms | ~5ms |

To measure:
```bash
# Install hyperfine for benchmarking
# Then run:
hyperfine 'curl -s http://localhost:5000/api/balances -H "Authorization: Bearer TOKEN"'
```
