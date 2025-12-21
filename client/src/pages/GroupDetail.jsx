import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { groups as groupApi } from '../services/api';
import AddExpenseModal from '../components/AddExpenseModal';

export default function GroupDetail() {
  const { id } = useParams();
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState({});
  const [settlements, setSettlements] = useState([]);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [memberEmail, setMemberEmail] = useState('');

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [groupRes, expensesRes, balancesRes, settlementsRes] = await Promise.all([
        groupApi.getById(id),
        groupApi.getExpenses(id),
        groupApi.getBalances(id),
        groupApi.getSettlements(id)
      ]);
      setGroup(groupRes.data);
      // Handle both paginated { data: [...] } and direct array responses
      const expensesData = expensesRes.data?.data || expensesRes.data;
      const settlementsData = settlementsRes.data?.data || settlementsRes.data;
      setExpenses(Array.isArray(expensesData) ? expensesData : []);
      setBalances(balancesRes.data);
      setSettlements(Array.isArray(settlementsData) ? settlementsData : []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await groupApi.addMember(id, memberEmail);
      setMemberEmail('');
      setShowMemberModal(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add member');
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString();
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  if (!group) {
    return <div className="container mx-auto px-4 py-8">Group not found</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{group.name}</h1>
        <div className="space-x-2">
          <button
            onClick={() => setShowMemberModal(true)}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            Add Member
          </button>
          <button
            onClick={() => setShowExpenseModal(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
          >
            Add Expense
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Members */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Members</h3>
          <ul className="space-y-2">
            {group.members.map((member) => (
              <li key={member._id} className="flex items-center">
                <span className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center mr-2 text-indigo-600 font-medium">
                  {member.name[0].toUpperCase()}
                </span>
                <div>
                  <p className="font-medium">{member.name}</p>
                  <p className="text-xs text-gray-500">{member.email}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Balances */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Group Balances</h3>
          {Object.keys(balances).length > 0 ? (
            <ul className="space-y-2 text-sm">
              {Object.entries(balances).map(([debtor, creditors]) =>
                Object.entries(creditors).map(([creditor, amt]) => {
                  const debtorName = group.members.find(m => m._id === debtor)?.name || debtor;
                  const creditorName = group.members.find(m => m._id === creditor)?.name || creditor;
                  return (
                    <li key={`${debtor}-${creditor}`} className="p-2 bg-gray-50 rounded">
                      <span className="text-red-600">{debtorName}</span> owes{' '}
                      <span className="text-green-600">{creditorName}</span>:{' '}
                      <span className="font-semibold">${amt.toFixed(2)}</span>
                    </li>
                  );
                })
              )}
            </ul>
          ) : (
            <p className="text-gray-500">All settled up! ✓</p>
          )}

          {/* Settlement Suggestions */}
          {settlements.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <h4 className="font-medium text-sm mb-2">💡 Suggested Settlements</h4>
              <ul className="space-y-1 text-sm">
                {settlements.map((s, i) => (
                  <li key={i} className="text-gray-600">
                    {s.fromUser?.name} → {s.toUser?.name}: ${s.amount.toFixed(2)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Expenses */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Expenses</h3>
          {expenses.length > 0 ? (
            <ul className="space-y-3">
              {expenses.map((expense) => (
                <li key={expense._id} className="border-b pb-2">
                  <div className="flex justify-between">
                    <span className="font-medium">{expense.description}</span>
                    <span className="font-semibold">${expense.amount.toFixed(2)}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    Paid by {expense.paidBy?.name} • {expense.splitType}
                  </div>
                  <div className="text-xs text-gray-400">
                    {formatDate(expense.date || expense.createdAt)}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">No expenses yet</p>
          )}
        </div>
      </div>

      {/* Add Expense Modal */}
      <AddExpenseModal
        isOpen={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        onSuccess={fetchData}
        preselectedGroup={id}
      />

      {/* Add Member Modal */}
      {showMemberModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Member</h2>
            {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
            <form onSubmit={handleAddMember}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  className="w-full p-3 border rounded"
                  placeholder="Enter member's email"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">User must be registered first</p>
              </div>
              <div className="flex justify-end space-x-2">
                <button 
                  type="button" 
                  onClick={() => { setShowMemberModal(false); setError(''); }} 
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
