import { useState, useEffect } from 'react';
import { balances as balanceApi, groups as groupApi, activities as activityApi } from '../services/api';

export default function Settlements() {
  const [balances, setBalances] = useState(null);
  const [groups, setGroups] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [recentSettlements, setRecentSettlements] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [balanceRes, groupRes, settlementsRes, activityRes] = await Promise.all([
        balanceApi.get(),
        groupApi.getAll(),
        balanceApi.getSettlements(),
        activityApi.get(20)
      ]);
      setBalances(balanceRes.data);
      // Handle both paginated { data: [...] } and direct array responses
      const groupData = groupRes.data?.data || groupRes.data;
      const settlementsData = settlementsRes.data?.data || settlementsRes.data;
      const activityData = activityRes.data?.data || activityRes.data;
      setGroups(Array.isArray(groupData) ? groupData : []);
      setSettlements(Array.isArray(settlementsData) ? settlementsData : []);
      // Filter only settlement activities
      const activities = Array.isArray(activityData) ? activityData : [];
      setRecentSettlements(activities.filter(a => a.type === 'settlement'));
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const openSettleModal = (debt) => {
    setSelectedDebt(debt);
    setSettleAmount(debt.amount.toString());
    // For direct balances, we'll use 'direct' as groupId
    setSelectedGroup(groups.length > 0 ? groups[0]._id : 'direct');
    setError('');
    setShowModal(true);
  };

  const handleSettle = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await balanceApi.settle({
        groupId: selectedGroup,
        creditorId: selectedDebt.to,
        amount: parseFloat(settleAmount)
      });
      setShowModal(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Settlement failed');
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Settlements</h1>

      <div className="grid md:grid-cols-2 gap-8 mb-8">
        {/* You Owe */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4 text-red-600">You Owe</h3>
          {balances?.owes?.length > 0 ? (
            <ul className="space-y-3">
              {balances.owes.map((item, i) => (
                <li key={i} className="flex justify-between items-center border-b pb-2">
                  <div>
                    <p className="font-medium">{item.user?.name || 'Unknown'}</p>
                    <p className="text-red-600">${item.amount.toFixed(2)}</p>
                  </div>
                  <button
                    onClick={() => openSettleModal(item)}
                    className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                  >
                    Settle
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">You don't owe anyone!</p>
          )}
          <div className="mt-4 pt-4 border-t">
            <p className="font-semibold">Total: ${balances?.totalOwes?.toFixed(2) || '0.00'}</p>
          </div>
        </div>

        {/* Owed to You */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4 text-green-600">Owed to You</h3>
          {balances?.owed?.length > 0 ? (
            <ul className="space-y-3">
              {balances.owed.map((item, i) => (
                <li key={i} className="flex justify-between items-center border-b pb-2">
                  <div>
                    <p className="font-medium">{item.user?.name || 'Unknown'}</p>
                    <p className="text-green-600">${item.amount.toFixed(2)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">No one owes you</p>
          )}
          <div className="mt-4 pt-4 border-t">
            <p className="font-semibold">Total: ${balances?.totalOwed?.toFixed(2) || '0.00'}</p>
          </div>
        </div>
      </div>

      {/* Settlement Suggestions */}
      {settlements.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h3 className="text-lg font-semibold mb-4">💡 Suggested Settlements</h3>
          <p className="text-gray-600 text-sm mb-4">
            These are the minimum transactions needed to settle all debts:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">#</th>
                  <th className="text-left py-2">From</th>
                  <th className="text-left py-2">To</th>
                  <th className="text-right py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {settlements.map((s, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2">{i + 1}</td>
                    <td className="py-2 text-red-600">{s.fromUser?.name || 'Unknown'}</td>
                    <td className="py-2 text-green-600">{s.toUser?.name || 'Unknown'}</td>
                    <td className="py-2 text-right font-medium">${s.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Settlements */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Recent Settlements</h3>
        {recentSettlements.length > 0 ? (
          <ul className="space-y-3">
            {recentSettlements.map((activity) => (
              <li key={activity._id} className="flex items-center gap-4 border-b pb-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600">✓</span>
                </div>
                <div className="flex-1">
                  <p>
                    <span className="font-medium">{activity.data?.fromUser?.name || activity.user?.name}</span>
                    {' paid '}
                    <span className="font-medium">{activity.data?.toUser?.name || 'someone'}</span>
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatDate(activity.createdAt)}
                    {activity.group && ` • ${activity.group.name}`}
                  </p>
                </div>
                <div className="text-green-600 font-semibold">
                  ${activity.data?.amount?.toFixed(2)}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No settlements yet</p>
        )}
      </div>

      {/* Settle Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Settle Up</h2>
            {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
            <p className="mb-4">
              Settling with <span className="font-semibold">{selectedDebt?.user?.name || 'Unknown'}</span>
            </p>
            <form onSubmit={handleSettle}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Settlement Type</label>
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="w-full p-3 border rounded"
                  required
                >
                  <option value="direct">Direct Settlement (no group)</option>
                  {groups.map((g) => (
                    <option key={g._id} value={g._id}>Group: {g.name}</option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  className="w-full p-3 border rounded"
                  max={selectedDebt?.amount}
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  Maximum: ${selectedDebt?.amount?.toFixed(2)}
                </p>
              </div>
              <div className="flex justify-end space-x-2">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Settle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
