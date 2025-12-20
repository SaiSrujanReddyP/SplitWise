import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { balances as balanceApi, groups as groupApi, activities as activityApi } from '../services/api';
import AddExpenseModal from '../components/AddExpenseModal';

export default function Dashboard() {
  const [balances, setBalances] = useState(null);
  const [groups, setGroups] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [balanceDetails, setBalanceDetails] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [balanceRes, groupRes, activityRes] = await Promise.all([
        balanceApi.get(),
        groupApi.getAll(),
        activityApi.get(10)
      ]);
      setBalances(balanceRes.data);
      setGroups(groupRes.data);
      setRecentActivity(activityRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const openDetails = async (user, type) => {
    setSelectedUser({ ...user, type });
    setShowDetailsModal(true);
    setLoadingDetails(true);
    try {
      const { data } = await balanceApi.getDetails(type === 'owes' ? user.to : user.from);
      setBalanceDetails(data);
    } catch (err) {
      console.error('Error fetching details:', err);
      setBalanceDetails([]);
    } finally {
      setLoadingDetails(false);
    }
  };

  const formatActivityMessage = (activity) => {
    switch (activity.type) {
      case 'expense_added':
        return `Added "${activity.data?.description}" - $${activity.data?.amount?.toFixed(2)}`;
      case 'settlement':
        return `${activity.data?.fromUser?.name || activity.user?.name} paid ${activity.data?.toUser?.name || 'someone'} $${activity.data?.amount?.toFixed(2)}`;
      case 'group_created':
        return `Created group "${activity.data?.groupName}"`;
      case 'member_added':
        return `Added member to "${activity.data?.groupName}"`;
      default:
        return 'Activity';
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <button
          onClick={() => setShowExpenseModal(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
        >
          + Add Expense
        </button>
      </div>

      {/* Balance Summary */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="bg-red-50 p-6 rounded-lg">
          <h3 className="text-gray-600 mb-2">You Owe</h3>
          <p className="text-2xl font-bold text-red-600">
            ${balances?.totalOwes?.toFixed(2) || '0.00'}
          </p>
          {balances?.owes?.length > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              to {balances.owes.length} {balances.owes.length === 1 ? 'person' : 'people'}
            </p>
          )}
        </div>
        <div className="bg-green-50 p-6 rounded-lg">
          <h3 className="text-gray-600 mb-2">Owed to You</h3>
          <p className="text-2xl font-bold text-green-600">
            ${balances?.totalOwed?.toFixed(2) || '0.00'}
          </p>
          {balances?.owed?.length > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              from {balances.owed.length} {balances.owed.length === 1 ? 'person' : 'people'}
            </p>
          )}
        </div>
        <div className="bg-blue-50 p-6 rounded-lg">
          <h3 className="text-gray-600 mb-2">Net Balance</h3>
          <p className={`text-2xl font-bold ${balances?.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {balances?.netBalance >= 0 ? '' : '-'}${Math.abs(balances?.netBalance || 0).toFixed(2)}
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Balance Details - Combined View */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Balance Details</h3>
            <Link to="/settlements" className="text-indigo-600 hover:underline text-sm">
              View All
            </Link>
          </div>
          
          {(balances?.owes?.length > 0 || balances?.owed?.length > 0) ? (
            <ul className="space-y-3">
              {/* You Owe */}
              {balances?.owes?.map((item, i) => (
                <li key={`owe-${i}`} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-red-600 text-sm font-medium">
                      {item.user?.name?.[0]?.toUpperCase() || '?'}
                    </span>
                    <div>
                      <p className="font-medium">{item.user?.name || 'Unknown'}</p>
                      <p className="text-xs text-red-600">You owe</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-red-600 font-semibold">${item.amount.toFixed(2)}</span>
                    <button
                      onClick={() => openDetails(item, 'owes')}
                      className="text-gray-400 hover:text-indigo-600 text-sm"
                      title="View details"
                    >
                      ℹ️
                    </button>
                  </div>
                </li>
              ))}
              
              {/* Owed to You */}
              {balances?.owed?.map((item, i) => (
                <li key={`owed-${i}`} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-sm font-medium">
                      {item.user?.name?.[0]?.toUpperCase() || '?'}
                    </span>
                    <div>
                      <p className="font-medium">{item.user?.name || 'Unknown'}</p>
                      <p className="text-xs text-green-600">Owes you</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 font-semibold">${item.amount.toFixed(2)}</span>
                    <button
                      onClick={() => openDetails(item, 'owed')}
                      className="text-gray-400 hover:text-indigo-600 text-sm"
                      title="View details"
                    >
                      ℹ️
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-center py-4">All settled up! 🎉</p>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Recent Activity */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
            {recentActivity.length > 0 ? (
              <ul className="space-y-3">
                {recentActivity.map((activity) => (
                  <li key={activity._id} className="border-b pb-2 last:border-0">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm
                        ${activity.type === 'expense_added' ? 'bg-blue-500' : ''}
                        ${activity.type === 'settlement' ? 'bg-green-500' : ''}
                        ${activity.type === 'group_created' ? 'bg-purple-500' : ''}
                        ${activity.type === 'member_added' ? 'bg-orange-500' : ''}
                      `}>
                        {activity.type === 'expense_added' && '$'}
                        {activity.type === 'settlement' && '✓'}
                        {activity.type === 'group_created' && '+'}
                        {activity.type === 'member_added' && '👤'}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm">{formatActivityMessage(activity)}</p>
                        <p className="text-xs text-gray-500">
                          {activity.user?.name} • {formatDate(activity.createdAt)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">No recent activity</p>
            )}
          </div>

          {/* Groups */}
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Your Groups</h3>
              <Link to="/groups" className="text-indigo-600 hover:underline text-sm">View All</Link>
            </div>
            {groups.length > 0 ? (
              <ul className="space-y-2">
                {groups.slice(0, 5).map((group) => (
                  <li key={group._id}>
                    <Link 
                      to={`/groups/${group._id}`} 
                      className="flex justify-between hover:bg-gray-50 p-2 rounded"
                    >
                      <span>{group.name}</span>
                      <span className="text-gray-500 text-sm">{group.members.length} members</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">
                No groups yet. <Link to="/groups" className="text-indigo-600">Create one</Link>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Add Expense Modal */}
      <AddExpenseModal
        isOpen={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        onSuccess={fetchData}
      />

      {/* Balance Details Modal */}
      {showDetailsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {selectedUser?.type === 'owes' ? 'You owe' : 'Owes you'}: {selectedUser?.user?.name}
              </h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ×
              </button>
            </div>
            
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <p className="text-lg font-semibold">
                Total: <span className={selectedUser?.type === 'owes' ? 'text-red-600' : 'text-green-600'}>
                  ${selectedUser?.amount?.toFixed(2)}
                </span>
              </p>
            </div>

            <h3 className="font-medium mb-2">Related Expenses</h3>
            {loadingDetails ? (
              <p className="text-gray-500">Loading...</p>
            ) : balanceDetails.length > 0 ? (
              <ul className="space-y-3">
                {balanceDetails.map((expense) => (
                  <li key={expense._id} className="border-b pb-2">
                    <div className="flex justify-between">
                      <span className="font-medium">{expense.description}</span>
                      <span>${expense.amount.toFixed(2)}</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      Paid by {expense.paidBy?.name}
                      {expense.group && ` • ${expense.group.name}`}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(expense.date).toLocaleDateString()}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">No expense details found</p>
            )}

            <div className="mt-4 pt-4 border-t">
              <Link
                to="/settlements"
                className="block w-full text-center bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700"
                onClick={() => setShowDetailsModal(false)}
              >
                Go to Settlements
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
