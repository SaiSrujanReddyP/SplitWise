#!/usr/bin/env node
require('dotenv').config();
const { program } = require('commander');
const chalk = require('chalk');
const Table = require('cli-table3');
const api = require('./api');

program
  .name('expense-cli')
  .description('CLI for expense sharing application')
  .version('1.0.0');

// ==================== AUTH COMMANDS ====================

program
  .command('login')
  .description('Login to the application')
  .requiredOption('-e, --email <email>', 'User email')
  .requiredOption('-p, --password <password>', 'User password')
  .action(async (options) => {
    try {
      const result = await api.login(options.email, options.password);
      console.log(chalk.green('✓ Login successful!'));
      console.log(chalk.cyan('Token:'), result.token);
      console.log(chalk.yellow('\nSet this token in your environment:'));
      console.log(chalk.white(`set EXPENSE_CLI_TOKEN=${result.token}`));
    } catch (err) {
      console.error(chalk.red('✗ Error:'), err.message);
    }
  });

program
  .command('signup')
  .description('Create a new account')
  .requiredOption('-n, --name <name>', 'User name')
  .requiredOption('-e, --email <email>', 'User email')
  .requiredOption('-p, --password <password>', 'User password')
  .action(async (options) => {
    try {
      const result = await api.signup(options.name, options.email, options.password);
      console.log(chalk.green('✓ Account created!'));
      console.log(chalk.cyan('Token:'), result.token);
      console.log(chalk.yellow('\nSet this token in your environment:'));
      console.log(chalk.white(`set EXPENSE_CLI_TOKEN=${result.token}`));
    } catch (err) {
      console.error(chalk.red('✗ Error:'), err.message);
    }
  });

// ==================== GROUP COMMANDS ====================

program
  .command('create-group <name>')
  .description('Create a new group')
  .option('-m, --members <emails...>', 'Member emails to add')
  .action(async (name, options) => {
    try {
      const group = await api.createGroup(name, options.members || []);
      console.log(chalk.green('✓ Group created:'), chalk.bold(group.name));
      console.log(chalk.gray('ID:'), group._id);
      console.log(chalk.gray('Members:'), group.members.map(m => m.email).join(', '));
    } catch (err) {
      console.error(chalk.red('✗ Error:'), err.message);
    }
  });

program
  .command('groups')
  .description('List all groups')
  .option('-l, --limit <number>', 'Number of groups to show', '20')
  .option('-c, --cursor <cursor>', 'Pagination cursor for next page')
  .action(async (options) => {
    try {
      const result = await api.getGroups({ limit: options.limit, cursor: options.cursor });
      const groups = result.data || result;
      
      if (groups.length === 0) {
        console.log(chalk.yellow('No groups found'));
        return;
      }

      const table = new Table({
        head: [chalk.cyan('Name'), chalk.cyan('ID'), chalk.cyan('Members')],
        colWidths: [20, 28, 30]
      });

      groups.forEach(g => {
        table.push([g.name, g._id, g.members.map(m => m.name).join(', ')]);
      });

      console.log(chalk.bold('\n📁 Your Groups\n'));
      console.log(table.toString());

      // Show pagination info
      if (result.pagination) {
        console.log(chalk.gray(`\nShowing ${groups.length} groups`));
        if (result.pagination.hasMore) {
          console.log(chalk.yellow(`More available. Use: expense-cli groups -c "${result.pagination.nextCursor}"`));
        }
      }
    } catch (err) {
      console.error(chalk.red('✗ Error:'), err.message);
    }
  });

program
  .command('group <groupId>')
  .description('View group details')
  .option('-l, --limit <number>', 'Number of expenses to show', '10')
  .action(async (groupId, options) => {
    try {
      const group = await api.getGroup(groupId);
      const expenseResult = await api.getGroupExpenses(groupId, { limit: options.limit });
      const expenses = expenseResult.data || expenseResult;
      const balances = await api.getGroupBalances(groupId);

      console.log(chalk.bold(`\n📁 ${group.name}\n`));

      // Members table
      const membersTable = new Table({
        head: [chalk.cyan('Member'), chalk.cyan('Email'), chalk.cyan('ID')],
      });
      group.members.forEach(m => membersTable.push([m.name, m.email, m._id]));
      console.log(chalk.bold('Members:'));
      console.log(membersTable.toString());

      // Balances
      console.log(chalk.bold('\nBalances:'));
      if (Object.keys(balances).length === 0) {
        console.log(chalk.green('  All settled up! ✓'));
      } else {
        const balanceTable = new Table({
          head: [chalk.red('Debtor'), chalk.green('Creditor'), chalk.yellow('Amount')],
        });
        for (const [debtor, creditors] of Object.entries(balances)) {
          for (const [creditor, amount] of Object.entries(creditors)) {
            if (amount > 0) {
              const debtorName = group.members.find(m => m._id === debtor)?.name || debtor;
              const creditorName = group.members.find(m => m._id === creditor)?.name || creditor;
              balanceTable.push([debtorName, creditorName, `$${amount.toFixed(2)}`]);
            }
          }
        }
        console.log(balanceTable.toString());
      }

      // Expenses
      console.log(chalk.bold('\nRecent Expenses:'));
      if (expenses.length === 0) {
        console.log(chalk.gray('  No expenses yet'));
      } else {
        const expenseTable = new Table({
          head: [chalk.cyan('Description'), chalk.cyan('Amount'), chalk.cyan('Paid By'), chalk.cyan('Split'), chalk.cyan('Date')],
        });
        expenses.forEach(e => {
          const date = new Date(e.date || e.createdAt).toLocaleDateString();
          expenseTable.push([e.description, `$${e.amount.toFixed(2)}`, e.paidBy?.name || 'Unknown', e.splitType, date]);
        });
        console.log(expenseTable.toString());

        if (expenseResult.pagination?.hasMore) {
          console.log(chalk.yellow(`\nMore expenses available. Use: expense-cli expenses -g ${groupId} -c "${expenseResult.pagination.nextCursor}"`));
        }
      }
    } catch (err) {
      console.error(chalk.red('✗ Error:'), err.message);
    }
  });

program
  .command('add-member')
  .description('Add a member to a group')
  .requiredOption('-g, --group <groupId>', 'Group ID')
  .requiredOption('-e, --email <email>', 'Member email')
  .action(async (options) => {
    try {
      const group = await api.addMember(options.group, options.email);
      console.log(chalk.green('✓ Member added to'), chalk.bold(group.name));
    } catch (err) {
      console.error(chalk.red('✗ Error:'), err.message);
    }
  });

program
  .command('delete-group <groupId>')
  .description('Delete a group (only creator can delete)')
  .action(async (groupId) => {
    try {
      await api.deleteGroup(groupId);
      console.log(chalk.green('✓ Group deleted successfully'));
    } catch (err) {
      console.error(chalk.red('✗ Error:'), err.message);
    }
  });

// ==================== EXPENSE COMMANDS ====================

program
  .command('add-expense')
  .description('Add an expense (group or direct)')
  .option('-g, --group <groupId>', 'Group ID (optional for direct expenses)')
  .requiredOption('-a, --amount <amount>', 'Expense amount')
  .requiredOption('-d, --description <desc>', 'Expense description')
  .option('-s, --split <type>', 'Split type: equal, exact, percentage', 'equal')
  .option('-p, --participants <data>', 'JSON array for participants/splits')
  .option('--date <date>', 'Expense date (YYYY-MM-DD)')
  .action(async (options) => {
    try {
      let participants = null;
      if (options.participants) {
        try {
          participants = JSON.parse(options.participants);
        } catch (e) {
          console.error(chalk.red('✗ Invalid JSON for participants'));
          console.log(chalk.yellow('Example for equal:'), '[{"userId":"abc123"}]');
          console.log(chalk.yellow('Example for exact:'), '[{"userId":"abc123","amount":50}]');
          console.log(chalk.yellow('Example for percentage:'), '[{"userId":"abc123","percentage":30}]');
          return;
        }
      }

      if (!options.group && !participants) {
        console.error(chalk.red('✗ For direct expenses, you must specify participants'));
        console.log(chalk.yellow('Use: expense-cli search-users <query> to find user IDs'));
        return;
      }
      
      const expense = await api.addExpense({
        groupId: options.group,
        amount: parseFloat(options.amount),
        description: options.description,
        splitType: options.split,
        participants,
        date: options.date
      });

      console.log(chalk.green('✓ Expense added:'), chalk.bold(expense.description));
      console.log(chalk.gray('Amount:'), `$${expense.amount.toFixed(2)}`);
      console.log(chalk.gray('Split type:'), expense.splitType);
      console.log(chalk.gray('Type:'), expense.group ? 'Group expense' : 'Direct expense');

      if (expense.splits && expense.splits.length > 0) {
        console.log(chalk.gray('Splits:'));
        expense.splits.forEach(s => {
          const name = s.userId?.name || s.userId;
          console.log(chalk.gray(`  • ${name}: $${s.amount.toFixed(2)}`));
        });
      }
    } catch (err) {
      console.error(chalk.red('✗ Error:'), err.message);
    }
  });

program
  .command('expenses')
  .description('List your expenses')
  .option('-g, --group <groupId>', 'Filter by group ID')
  .option('-l, --limit <number>', 'Number of expenses to show', '20')
  .option('-c, --cursor <cursor>', 'Pagination cursor for next page')
  .action(async (options) => {
    try {
      let result;
      if (options.group) {
        result = await api.getGroupExpenses(options.group, { limit: options.limit, cursor: options.cursor });
      } else {
        result = await api.getMyExpenses({ limit: options.limit, cursor: options.cursor });
      }
      
      const expenses = result.data || result;

      if (expenses.length === 0) {
        console.log(chalk.yellow('No expenses found'));
        return;
      }

      const table = new Table({
        head: [chalk.cyan('Description'), chalk.cyan('Amount'), chalk.cyan('Paid By'), chalk.cyan('Group'), chalk.cyan('Split'), chalk.cyan('Date')],
      });

      expenses.forEach(e => {
        const date = new Date(e.date || e.createdAt).toLocaleDateString();
        table.push([
          e.description,
          `$${e.amount.toFixed(2)}`,
          e.paidBy?.name || 'Unknown',
          e.group?.name || 'Direct',
          e.splitType,
          date
        ]);
      });

      console.log(chalk.bold('\n💸 Your Expenses\n'));
      console.log(table.toString());

      if (result.pagination) {
        console.log(chalk.gray(`\nShowing ${expenses.length} expenses`));
        if (result.pagination.hasMore) {
          console.log(chalk.yellow(`More available. Use: expense-cli expenses -c "${result.pagination.nextCursor}"`));
        }
      }
    } catch (err) {
      console.error(chalk.red('✗ Error:'), err.message);
    }
  });

// ==================== USER SEARCH ====================

program
  .command('search-users <query>')
  .description('Search for users by name or email')
  .action(async (query) => {
    try {
      if (query.length < 2) {
        console.log(chalk.yellow('Query must be at least 2 characters'));
        return;
      }

      const users = await api.searchUsers(query);

      if (users.length === 0) {
        console.log(chalk.yellow('No users found'));
        return;
      }

      const table = new Table({
        head: [chalk.cyan('Name'), chalk.cyan('Email'), chalk.cyan('ID')],
      });

      users.forEach(u => {
        table.push([u.name, u.email, u._id]);
      });

      console.log(chalk.bold('\n👥 Users Found\n'));
      console.log(table.toString());
      console.log(chalk.gray('\nUse the ID for direct expenses or adding to groups'));
    } catch (err) {
      console.error(chalk.red('✗ Error:'), err.message);
    }
  });

// ==================== BALANCE COMMANDS ====================

program
  .command('balances')
  .description('View your balances')
  .action(async () => {
    try {
      const balances = await api.getBalances();
      
      console.log(chalk.bold('\n💰 Your Balances\n'));

      // Summary
      const summaryTable = new Table();
      summaryTable.push(
        { [chalk.red('You Owe')]: chalk.red(`$${balances.totalOwes.toFixed(2)}`) },
        { [chalk.green('Owed to You')]: chalk.green(`$${balances.totalOwed.toFixed(2)}`) },
        { [chalk.cyan('Net Balance')]: balances.netBalance >= 0 
          ? chalk.green(`$${balances.netBalance.toFixed(2)}`) 
          : chalk.red(`-$${Math.abs(balances.netBalance).toFixed(2)}`) }
      );
      console.log(summaryTable.toString());

      // You owe
      if (balances.owes.length > 0) {
        console.log(chalk.bold.red('\n📤 You Owe:'));
        const owesTable = new Table({
          head: [chalk.cyan('To'), chalk.cyan('Amount'), chalk.cyan('User ID')],
        });
        balances.owes.forEach(item => {
          owesTable.push([
            item.user?.name || 'Unknown',
            chalk.red(`$${item.amount.toFixed(2)}`),
            item.to || item.user?._id || ''
          ]);
        });
        console.log(owesTable.toString());
      }

      // Owed to you
      if (balances.owed.length > 0) {
        console.log(chalk.bold.green('\n📥 Owed to You:'));
        const owedTable = new Table({
          head: [chalk.cyan('From'), chalk.cyan('Amount'), chalk.cyan('User ID')],
        });
        balances.owed.forEach(item => {
          owedTable.push([
            item.user?.name || 'Unknown',
            chalk.green(`$${item.amount.toFixed(2)}`),
            item.from || item.user?._id || ''
          ]);
        });
        console.log(owedTable.toString());
      }

      if (balances.owes.length === 0 && balances.owed.length === 0) {
        console.log(chalk.green('\n✓ All settled up!'));
      }

      console.log(chalk.gray('\nUse: expense-cli balance-details <userId> to see expense breakdown'));
    } catch (err) {
      console.error(chalk.red('✗ Error:'), err.message);
    }
  });

program
  .command('balance-details <userId>')
  .description('View detailed expenses contributing to a balance')
  .action(async (userId) => {
    try {
      const details = await api.getBalanceDetails(userId);

      if (details.length === 0) {
        console.log(chalk.yellow('No expense details found for this user'));
        return;
      }

      console.log(chalk.bold('\n📋 Balance Details\n'));

      const table = new Table({
        head: [chalk.cyan('Description'), chalk.cyan('Total'), chalk.cyan('Your Share'), chalk.cyan('Paid By'), chalk.cyan('Group'), chalk.cyan('Date')],
      });

      details.forEach(e => {
        const date = new Date(e.date).toLocaleDateString();
        table.push([
          e.description,
          `$${e.amount.toFixed(2)}`,
          `$${e.splitAmount.toFixed(2)}`,
          e.paidBy?.name || 'Unknown',
          e.group?.name || 'Direct',
          date
        ]);
      });

      console.log(table.toString());
    } catch (err) {
      console.error(chalk.red('✗ Error:'), err.message);
    }
  });

// ==================== SETTLEMENT COMMANDS ====================

program
  .command('settlements')
  .description('View settlement suggestions (minimal transactions to settle all debts)')
  .option('-g, --group <groupId>', 'Group ID (optional, shows all if not specified)')
  .action(async (options) => {
    try {
      const settlements = options.group 
        ? await api.getGroupSettlements(options.group)
        : await api.getSettlements();
      
      console.log(chalk.bold('\n🔄 Settlement Suggestions\n'));
      console.log(chalk.gray('These are the minimum transactions needed to settle all debts:\n'));

      if (settlements.length === 0) {
        console.log(chalk.green('✓ No settlements needed - all balanced!'));
        return;
      }

      const table = new Table({
        head: [chalk.cyan('#'), chalk.red('From'), chalk.green('To'), chalk.yellow('Amount')],
      });

      settlements.forEach((s, i) => {
        table.push([
          i + 1,
          s.fromUser?.name || s.from,
          s.toUser?.name || s.to,
          chalk.yellow(`$${s.amount.toFixed(2)}`)
        ]);
      });

      console.log(table.toString());
      console.log(chalk.gray(`\nTotal transactions: ${settlements.length}`));
      console.log(chalk.gray('Use: expense-cli settle -g <groupId> -t <creditorId> -a <amount>'));
    } catch (err) {
      console.error(chalk.red('✗ Error:'), err.message);
    }
  });

program
  .command('settle')
  .description('Settle a balance (group or direct)')
  .requiredOption('-t, --to <userId>', 'User ID to settle with (creditor)')
  .requiredOption('-a, --amount <amount>', 'Amount to settle')
  .option('-g, --group <groupId>', 'Group ID (use "direct" for non-group settlements)')
  .action(async (options) => {
    try {
      const groupId = options.group || 'direct';
      
      await api.settle({
        groupId,
        creditorId: options.to,
        amount: parseFloat(options.amount)
      });

      console.log(chalk.green('✓ Settlement recorded!'));
      console.log(chalk.gray(`Settled $${parseFloat(options.amount).toFixed(2)}`));
      console.log(chalk.gray(`Type: ${groupId === 'direct' ? 'Direct settlement' : 'Group settlement'}`));
    } catch (err) {
      console.error(chalk.red('✗ Error:'), err.message);
    }
  });

// ==================== ACTIVITY COMMANDS ====================

program
  .command('activity')
  .description('View recent activity')
  .option('-l, --limit <number>', 'Number of activities to show', '10')
  .option('-c, --cursor <cursor>', 'Pagination cursor for next page')
  .action(async (options) => {
    try {
      const result = await api.getActivities({ limit: options.limit, cursor: options.cursor });
      const activities = result.data || result;
      
      console.log(chalk.bold('\n📋 Recent Activity\n'));

      if (activities.length === 0) {
        console.log(chalk.gray('No recent activity'));
        return;
      }

      const table = new Table({
        head: [chalk.cyan('Type'), chalk.cyan('Description'), chalk.cyan('User'), chalk.cyan('Date')],
      });

      activities.forEach(a => {
        let desc = '';
        let type = '';
        
        switch (a.type) {
          case 'expense_added':
            type = chalk.blue('Expense');
            desc = `${a.data?.description || 'Unknown'} - $${(a.data?.amount || 0).toFixed(2)}`;
            break;
          case 'settlement':
            type = chalk.green('Settlement');
            desc = `$${(a.data?.amount || 0).toFixed(2)} to ${a.data?.toUser?.name || 'someone'}`;
            break;
          case 'group_created':
            type = chalk.magenta('Group');
            desc = `Created "${a.data?.groupName || 'Unknown'}"`;
            break;
          case 'group_deleted':
            type = chalk.red('Group');
            desc = `Deleted "${a.data?.groupName || 'Unknown'}"`;
            break;
          case 'member_added':
            type = chalk.yellow('Member');
            desc = `Added to "${a.data?.groupName || 'Unknown'}"`;
            break;
          default:
            type = a.type;
            desc = a.data?.description || '';
        }

        const date = new Date(a.createdAt).toLocaleDateString();
        table.push([type, desc, a.user?.name || 'Unknown', date]);
      });

      console.log(table.toString());

      if (result.pagination) {
        console.log(chalk.gray(`\nShowing ${activities.length} activities`));
        if (result.pagination.hasMore) {
          console.log(chalk.yellow(`More available. Use: expense-cli activity -c "${result.pagination.nextCursor}"`));
        }
      }
    } catch (err) {
      console.error(chalk.red('✗ Error:'), err.message);
    }
  });

// ==================== HEALTH CHECK ====================

program
  .command('health')
  .description('Check server health and status')
  .action(async () => {
    try {
      const health = await api.getHealth();
      
      console.log(chalk.bold('\n🏥 Server Health\n'));

      const statusTable = new Table();
      statusTable.push(
        { [chalk.cyan('Status')]: health.status === 'ok' ? chalk.green('✓ OK') : chalk.red('✗ Error') },
        { [chalk.cyan('Timestamp')]: health.timestamp }
      );
      console.log(statusTable.toString());

      // Services
      if (health.services) {
        console.log(chalk.bold('\nServices:'));
        const servicesTable = new Table();
        servicesTable.push(
          { [chalk.cyan('Redis')]: health.services.redis === 'connected' 
            ? chalk.green('✓ Connected') 
            : chalk.yellow('⚠ Disconnected (using fallback)') },
          { [chalk.cyan('Active Locks')]: health.services.locks.toString() }
        );
        console.log(servicesTable.toString());
      }

      // Queues
      if (health.queues) {
        console.log(chalk.bold('\nJob Queues:'));
        const queuesTable = new Table({
          head: [chalk.cyan('Queue'), chalk.cyan('Processed'), chalk.cyan('Failed'), chalk.cyan('Pending')],
        });
        
        for (const [name, stats] of Object.entries(health.queues)) {
          queuesTable.push([
            name,
            chalk.green(stats.processed.toString()),
            stats.failed > 0 ? chalk.red(stats.failed.toString()) : '0',
            stats.pending > 0 ? chalk.yellow(stats.pending.toString()) : '0'
          ]);
        }
        console.log(queuesTable.toString());
      }
    } catch (err) {
      console.error(chalk.red('✗ Server unreachable:'), err.message);
    }
  });

// ==================== HELP ====================

program
  .command('examples')
  .description('Show usage examples')
  .action(() => {
    console.log(chalk.bold('\n📖 Usage Examples\n'));
    
    console.log(chalk.cyan('Authentication:'));
    console.log('  expense-cli signup -n "John Doe" -e john@example.com -p password123');
    console.log('  expense-cli login -e john@example.com -p password123');
    
    console.log(chalk.cyan('\nGroups:'));
    console.log('  expense-cli create-group "Trip to Paris" -m alice@example.com bob@example.com');
    console.log('  expense-cli groups');
    console.log('  expense-cli group <groupId>');
    console.log('  expense-cli add-member -g <groupId> -e charlie@example.com');
    console.log('  expense-cli delete-group <groupId>');
    
    console.log(chalk.cyan('\nExpenses (Group):'));
    console.log('  expense-cli add-expense -g <groupId> -a 120 -d "Dinner" -s equal');
    console.log('  expense-cli add-expense -g <groupId> -a 100 -d "Groceries" -s exact -p \'[{"userId":"abc","amount":60}]\'');
    console.log('  expense-cli add-expense -g <groupId> -a 200 -d "Hotel" -s percentage -p \'[{"userId":"abc","percentage":40}]\'');
    
    console.log(chalk.cyan('\nExpenses (Direct - no group):'));
    console.log('  expense-cli search-users "alice"');
    console.log('  expense-cli add-expense -a 50 -d "Coffee" -s equal -p \'[{"userId":"<userId>"}]\'');
    
    console.log(chalk.cyan('\nBalances & Settlements:'));
    console.log('  expense-cli balances');
    console.log('  expense-cli balance-details <userId>');
    console.log('  expense-cli settlements');
    console.log('  expense-cli settlements -g <groupId>');
    console.log('  expense-cli settle -t <creditorId> -a 50 -g <groupId>');
    console.log('  expense-cli settle -t <creditorId> -a 50  # Direct settlement');
    
    console.log(chalk.cyan('\nOther:'));
    console.log('  expense-cli activity -l 20');
    console.log('  expense-cli health');
    console.log('  expense-cli expenses -l 10');
  });

program.parse();
