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

// Auth commands
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
    } catch (err) {
      console.error(chalk.red('✗ Error:'), err.message);
    }
  });

// Group commands
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
  .action(async () => {
    try {
      const groups = await api.getGroups();
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
    } catch (err) {
      console.error(chalk.red('✗ Error:'), err.message);
    }
  });

program
  .command('group <groupId>')
  .description('View group details')
  .action(async (groupId) => {
    try {
      const group = await api.getGroup(groupId);
      const expenses = await api.getGroupExpenses(groupId);
      const balances = await api.getGroupBalances(groupId);

      console.log(chalk.bold(`\n📁 ${group.name}\n`));

      // Members table
      const membersTable = new Table({
        head: [chalk.cyan('Member'), chalk.cyan('Email')],
      });
      group.members.forEach(m => membersTable.push([m.name, m.email]));
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
            const debtorName = group.members.find(m => m._id === debtor)?.name || debtor;
            const creditorName = group.members.find(m => m._id === creditor)?.name || creditor;
            balanceTable.push([debtorName, creditorName, `$${amount.toFixed(2)}`]);
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
          head: [chalk.cyan('Description'), chalk.cyan('Amount'), chalk.cyan('Paid By'), chalk.cyan('Split')],
        });
        expenses.slice(0, 10).forEach(e => {
          expenseTable.push([e.description, `$${e.amount.toFixed(2)}`, e.paidBy?.name || 'Unknown', e.splitType]);
        });
        console.log(expenseTable.toString());
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


// Expense commands
program
  .command('add-expense')
  .description('Add an expense to a group')
  .requiredOption('-g, --group <groupId>', 'Group ID')
  .requiredOption('-a, --amount <amount>', 'Expense amount')
  .requiredOption('-d, --description <desc>', 'Expense description')
  .option('-s, --split <type>', 'Split type: equal, exact, percentage', 'equal')
  .option('-p, --participants <data>', 'JSON array for exact/percentage splits')
  .action(async (options) => {
    try {
      let participants = null;
      if (options.participants) {
        try {
          participants = JSON.parse(options.participants);
        } catch (e) {
          console.error(chalk.red('✗ Invalid JSON for participants'));
          console.log(chalk.yellow('Example for exact:'), '[{"userId":"abc","amount":50}]');
          console.log(chalk.yellow('Example for percentage:'), '[{"userId":"abc","percentage":30}]');
          return;
        }
      }
      
      const expense = await api.addExpense({
        groupId: options.group,
        amount: parseFloat(options.amount),
        description: options.description,
        splitType: options.split,
        participants
      });

      console.log(chalk.green('✓ Expense added:'), chalk.bold(expense.description));
      console.log(chalk.gray('Amount:'), `$${expense.amount.toFixed(2)}`);
      console.log(chalk.gray('Split type:'), expense.splitType);

      if (expense.splits && expense.splits.length > 0) {
        console.log(chalk.gray('Splits:'));
        expense.splits.forEach(s => {
          console.log(chalk.gray(`  • ${s.userId}: $${s.amount.toFixed(2)}`));
        });
      }
    } catch (err) {
      console.error(chalk.red('✗ Error:'), err.message);
    }
  });

// Balance commands
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
          head: [chalk.cyan('To'), chalk.cyan('Amount')],
        });
        balances.owes.forEach(item => {
          owesTable.push([item.user?.name || 'Unknown', chalk.red(`$${item.amount.toFixed(2)}`)]);
        });
        console.log(owesTable.toString());
      }

      // Owed to you
      if (balances.owed.length > 0) {
        console.log(chalk.bold.green('\n📥 Owed to You:'));
        const owedTable = new Table({
          head: [chalk.cyan('From'), chalk.cyan('Amount')],
        });
        balances.owed.forEach(item => {
          owedTable.push([item.user?.name || 'Unknown', chalk.green(`$${item.amount.toFixed(2)}`)]);
        });
        console.log(owedTable.toString());
      }

      if (balances.owes.length === 0 && balances.owed.length === 0) {
        console.log(chalk.green('\n✓ All settled up!'));
      }
    } catch (err) {
      console.error(chalk.red('✗ Error:'), err.message);
    }
  });

// Settlement suggestions
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
    } catch (err) {
      console.error(chalk.red('✗ Error:'), err.message);
    }
  });

program
  .command('settle')
  .description('Settle a balance')
  .requiredOption('-g, --group <groupId>', 'Group ID')
  .requiredOption('-t, --to <userId>', 'User ID to settle with (creditor)')
  .requiredOption('-a, --amount <amount>', 'Amount to settle')
  .action(async (options) => {
    try {
      await api.settle({
        groupId: options.group,
        creditorId: options.to,
        amount: parseFloat(options.amount)
      });
      console.log(chalk.green('✓ Settlement recorded!'));
      console.log(chalk.gray(`Settled $${parseFloat(options.amount).toFixed(2)}`));
    } catch (err) {
      console.error(chalk.red('✗ Error:'), err.message);
    }
  });

// Activity command
program
  .command('activity')
  .description('View recent activity')
  .option('-l, --limit <number>', 'Number of activities to show', '10')
  .action(async (options) => {
    try {
      const activities = await api.getActivities(parseInt(options.limit));
      
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
            desc = `${a.data?.description} - $${a.data?.amount?.toFixed(2)}`;
            break;
          case 'settlement':
            type = chalk.green('Settlement');
            desc = `$${a.data?.amount?.toFixed(2)} to ${a.data?.toUser?.name || 'someone'}`;
            break;
          case 'group_created':
            type = chalk.purple('Group');
            desc = `Created "${a.data?.groupName}"`;
            break;
          default:
            type = a.type;
            desc = a.data?.description || '';
        }

        const date = new Date(a.createdAt).toLocaleDateString();
        table.push([type, desc, a.user?.name || 'Unknown', date]);
      });

      console.log(table.toString());
    } catch (err) {
      console.error(chalk.red('✗ Error:'), err.message);
    }
  });

program.parse();
