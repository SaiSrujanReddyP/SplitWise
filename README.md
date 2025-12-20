# Expense Sharing Application

A simplified expense sharing application inspired by Splitwise, built with clean architecture and correct balance logic.

## Architecture Overview

```
├── client/        # React (Vite, JavaScript)
├── server/        # Node.js + Express backend
├── cli/           # Command-line interface
├── shared/        # Shared business logic
└── README.md
```

## System Design Decisions

### 1. Layered Architecture

The application follows a clean layered architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│         (React Frontend / CLI Interface)                 │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                      API Layer                           │
│              (Express Routes + Controllers)              │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    Service Layer                         │
│    (Business Logic - imports from shared/)               │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                     Data Layer                           │
│              (MongoDB via Mongoose)                      │
└─────────────────────────────────────────────────────────┘
```

**Why this design?**
- **Separation of Concerns**: Each layer has a single responsibility
- **Testability**: Services can be unit tested without HTTP/DB dependencies
- **Reusability**: Shared logic used by both server and CLI
- **Maintainability**: Changes in one layer don't cascade to others

### 2. Dual Balance Tracking System

The application supports two types of balances:

#### Group Balances (Embedded in Group document)
```javascript
// Stored in Group.balances as a Map
balance[A][B] = amount A owes B
```

#### Direct Balances (Separate DirectBalance collection)
```javascript
// For non-group expenses between users
{ debtor: userId, creditor: userId, amount: Number }
```

**Why two systems?**
- **Group balances** are embedded for fast group-specific queries
- **Direct balances** allow user-to-user expenses without creating a group
- Both use the same simplification algorithm (mutual debts cancel out)
- `getUserBalances()` aggregates both for a complete picture

**Simplification Algorithm:**
- When A owes B $50 and B owes A $30, we simplify to: A owes B $20
- This is done automatically by the `BalanceCalculator` class
- Maintains the invariant that for any pair (A,B), only one direction has a non-zero balance

**Why this approach?**
- O(1) lookup for any user pair's balance
- Automatic simplification prevents debt cycles
- Easy to aggregate across multiple groups and direct balances

### 3. Settlement Optimization (Greedy Algorithm)

The `settlementService.js` converts complex balance matrices into minimal payment transactions:

```
Input:  A owes B $30, A owes C $20, B owes C $10
Output: A pays B $30, A pays C $10, B pays C $0 (simplified)
```

**Algorithm:**
1. Calculate net balance for each user (creditor vs debtor)
2. Sort creditors and debtors by amount (descending)
3. Greedily match largest debtor with largest creditor
4. Create transaction for min(debt, credit), adjust, repeat

**Why greedy instead of optimal?**
- O(n²) time complexity vs O(n!) for optimal
- Produces near-optimal results in practice
- Simple to implement and debug
- No external dependencies (no heap required)

### 4. Concurrency Control (Lock Manager)

The `lockManager.js` provides group-level write locks:

```javascript
await lockManager.withLock(groupId, async () => {
  // Only one operation per group at a time
  await updateBalances(...);
});
```

**Why this design?**
- Prevents race conditions when multiple users modify same group
- Per-group locking allows parallel operations on different groups
- Promise-based queue ensures FIFO ordering
- Automatic cleanup prevents memory leaks

### 5. Activity Tracking System

The application tracks all user activities for transparency and audit:

**Activity Types:**
- `expense_added` - When a new expense is created
- `settlement` - When a user settles a debt (group or direct)
- `group_created` - When a new group is created
- `member_added` - When a member joins a group

**Why activity tracking?**
- Provides audit trail for all financial transactions
- Enables "Recent Activity" feed on dashboard
- Shows settlement history in Settlements page
- Helps users track what happened and when

### 6. Split Types

| Type | Description | Use Case |
|------|-------------|----------|
| **Equal** | Amount ÷ participants | Shared meals, utilities |
| **Exact** | Specific amounts per person | Different items purchased |
| **Percentage** | % of total per person | Rent by room size |

### 7. Flexible Expense Creation

Expenses can be created in two ways:

1. **Group Expenses**: Select a group, optionally select specific members
   - Balances stored in Group.balances
   - Settlement requires selecting the group

2. **Non-Group (Direct) Expenses**: Search and select individual users
   - Balances stored in DirectBalance collection
   - Settlement uses `groupId: 'direct'`

**Why this flexibility?**
- Not all expenses belong to a formal group
- Quick one-off splits between friends
- User search makes it easy to find people
- Both types appear in unified balance view

### 8. Balance Details Feature

Users can view detailed breakdown of any balance:

```javascript
// GET /balances/details/:userId
// Returns expenses that contributed to the balance
[
  { description, amount, splitAmount, paidBy, group, date }
]
```

**Why this feature?**
- Transparency: Users can see exactly why they owe/are owed money
- Dispute resolution: Easy to identify specific expenses
- Sorted by date (most recent first) for relevance

### 9. Shared Business Logic

Core logic lives in `/shared` and is imported by the server:

```
shared/
├── balanceCalculator.js  # Net balance tracking & simplification
├── splitCalculator.js    # Split type calculations
└── index.js              # Exports
```

**Why shared?**
- Single source of truth for business rules
- Server services import and use this logic
- CLI calls API endpoints (which use shared logic)
- No code duplication

## Features

### Web Application

#### Dashboard
- Balance summary cards (You Owe, Owed to You, Net Balance)
- Combined "Balance Details" section showing all balances
- Info button (ℹ️) on each balance opens details modal
- Details modal shows related expenses with dates
- Recent Activity feed
- Quick "Add Expense" button
- Your Groups list

#### Groups
- Create groups, add members
- View group expenses and balances
- Settlement suggestions per group
- Add expense directly from group page

#### Add Expense Modal
- Group selection (optional - can create non-group expenses)
- User search to find and select users by name/email
- Date picker for expense date
- All split types (equal, exact, percentage)
- Live preview of splits before submitting

#### Settlements
- View "You Owe" with Settle buttons
- View "Owed to You" 
- Settlement suggestions (minimal transactions algorithm)
- Recent Settlements history
- Support for both group and direct settlements

### CLI Tool
- Colored output with chalk
- Formatted tables with cli-table3
- All CRUD operations for groups and expenses
- Balance viewing and settlement
- Activity feed
- All split types supported

## Folder Structure

### Server (`/server`)
```
server/
├── config/         # Database configuration
├── controllers/    # Thin route handlers (no business logic)
├── middleware/     # Auth middleware (JWT verification)
├── models/
│   ├── User.js
│   ├── Group.js           # With embedded balances Map
│   ├── Expense.js         # With optional group reference
│   ├── Activity.js        # Activity tracking
│   └── DirectBalance.js   # Non-group balances
├── routes/
├── services/
│   ├── authService.js
│   ├── groupService.js
│   ├── expenseService.js      # Handles both group & direct expenses
│   ├── balanceService.js      # Aggregates group & direct balances
│   ├── settlementService.js   # Greedy settlement algorithm
│   └── activityService.js     # Activity logging
├── utils/
│   └── lockManager.js         # Concurrency control
└── index.js
```

### Client (`/client`)
```
client/
├── src/
│   ├── components/
│   │   ├── Navbar.jsx
│   │   ├── ProtectedRoute.jsx
│   │   └── AddExpenseModal.jsx  # Reusable expense form
│   ├── context/
│   │   └── AuthContext.jsx
│   ├── pages/
│   │   ├── Home.jsx
│   │   ├── Login.jsx
│   │   ├── Signup.jsx
│   │   ├── Dashboard.jsx      # With balance details modal
│   │   ├── Groups.jsx
│   │   ├── GroupDetail.jsx
│   │   └── Settlements.jsx    # With direct settlement support
│   └── services/
│       └── api.js
└── index.html
```

### CLI (`/cli`)
```
cli/
├── index.js        # Commander.js commands
├── api.js          # API client
└── package.json    # chalk, cli-table3 for formatting
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/signup | Register new user |
| POST | /auth/login | Login user |
| POST | /groups | Create group |
| GET | /groups | Get user's groups |
| GET | /groups/:id | Get group details |
| POST | /groups/:id/members | Add member to group |
| GET | /groups/:id/expenses | Get group expenses |
| GET | /groups/:id/balances | Get group balances |
| GET | /groups/:id/settlements | Get settlement suggestions for group |
| POST | /expenses | Add expense (group or non-group) |
| GET | /expenses/mine | Get user's expenses |
| GET | /expenses/search-users | Search users by name/email |
| GET | /expenses/:id | Get expense details |
| GET | /balances | Get user's balances (group + direct) |
| GET | /balances/settlements | Get global settlement suggestions |
| GET | /balances/details/:userId | Get expense details for a balance |
| POST | /balances/settle | Record settlement (group or direct) |
| GET | /activities | Get recent activities |

## Environment Variables

### Server (.env)
```env
PORT=5000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/expense-sharing
JWT_SECRET=your-secret-key
```

### Client (.env)
```env
VITE_API_URL=http://localhost:5000/api
```

## Running the Application

### Server
```bash
cd server
npm install
npm start
```

### Client
```bash
cd client
npm install
npm run dev
```

### CLI
```bash
cd cli
npm install
npm link
expense-cli --help
```

## CLI Commands

```bash
# Authentication
expense-cli signup -n "John" -e john@example.com -p password123
expense-cli login -e john@example.com -p password123

# Groups
expense-cli create-group "Trip to Paris"
expense-cli groups
expense-cli group <groupId>
expense-cli add-member -g <groupId> -e friend@example.com

# Expenses (all split types supported)
expense-cli add-expense -g <groupId> -a 100 -d "Dinner" -s equal
expense-cli add-expense -g <groupId> -a 100 -d "Groceries" -s exact -p '[{"userId":"...","amount":60}]'
expense-cli add-expense -g <groupId> -a 100 -d "Rent" -s percentage -p '[{"userId":"...","percentage":40}]'

# Balances & Settlements
expense-cli balances
expense-cli settlements
expense-cli settlements -g <groupId>
expense-cli settle -g <groupId> -t <creditorId> -a 50

# Activity
expense-cli activity
expense-cli activity -l 20
```

## Tech Stack

- **Frontend**: React 18, Vite, React Router, Axios, Tailwind CSS
- **Backend**: Node.js, Express.js, MongoDB (Mongoose)
- **CLI**: Commander.js, Chalk, cli-table3
- **Auth**: JWT (JSON Web Tokens)

## Data Models

### User
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed)
}
```

### Group
```javascript
{
  name: String,
  members: [ObjectId -> User],
  createdBy: ObjectId -> User,
  balances: Map  // balance[debtor][creditor] = amount
}
```

### Expense
```javascript
{
  description: String,
  amount: Number,
  paidBy: ObjectId -> User,
  group: ObjectId -> Group (optional for direct expenses),
  splitType: 'equal' | 'exact' | 'percentage',
  date: Date,
  participants: [{ userId, amount?, percentage? }],
  splits: [{ userId, amount }]
}
```

### DirectBalance
```javascript
{
  debtor: ObjectId -> User,
  creditor: ObjectId -> User,
  amount: Number,
  lastUpdated: Date
}
```

### Activity
```javascript
{
  type: 'expense_added' | 'settlement' | 'group_created' | 'member_added',
  user: ObjectId -> User,
  group: ObjectId -> Group (optional),
  expense: ObjectId -> Expense (optional),
  data: { description, amount, fromUser, toUser, groupName }
}
```

## Key Design Tradeoffs

| Decision | Alternative | Why I Chose This |
|----------|-------------|------------------|
| Embedded group balances | Separate collection | Faster reads, atomic updates with group |
| Separate DirectBalance | Embed in User | Cleaner queries, easier to extend |
| Greedy settlement | Optimal (NP-hard) | O(n²) vs O(n!), good enough in practice |
| Per-group locks | Global lock | Allows parallel ops on different groups |
| Activity as separate collection | Embed in entities | Flexible querying, no size limits |
| Shared business logic folder | Duplicate in server | Single source of truth, DRY principle |
