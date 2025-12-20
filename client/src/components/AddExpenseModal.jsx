import { useState, useEffect } from 'react';
import { groups as groupApi, expenses as expenseApi } from '../services/api';

export default function AddExpenseModal({ isOpen, onClose, onSuccess, preselectedGroup }) {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(preselectedGroup || '');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [splitType, setSplitType] = useState('equal');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // User search for non-group expenses
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [participantShares, setParticipantShares] = useState([]);

  // Group members for group expenses
  const [groupMembers, setGroupMembers] = useState([]);

  useEffect(() => {
    if (isOpen) {
      fetchGroups();
      setSelectedGroup(preselectedGroup || '');
    }
  }, [isOpen, preselectedGroup]);

  useEffect(() => {
    if (selectedGroup) {
      fetchGroupMembers(selectedGroup);
    } else {
      setGroupMembers([]);
      setParticipantShares([]);
    }
  }, [selectedGroup]);

  useEffect(() => {
    // Update participant shares when selected users change (non-group)
    if (!selectedGroup && selectedUsers.length > 0) {
      setParticipantShares(selectedUsers.map(u => ({
        userId: u._id,
        name: u.name,
        amount: '',
        percentage: ''
      })));
    }
  }, [selectedUsers, selectedGroup]);

  const fetchGroups = async () => {
    try {
      const { data } = await groupApi.getAll();
      setGroups(data);
    } catch (err) {
      console.error('Error fetching groups:', err);
    }
  };

  const fetchGroupMembers = async (groupId) => {
    try {
      const { data } = await groupApi.getById(groupId);
      const currentUser = JSON.parse(localStorage.getItem('user'));
      const others = data.members.filter(m => m._id !== currentUser?.id);
      setGroupMembers(data.members);
      setParticipantShares(others.map(m => ({
        userId: m._id,
        name: m.name,
        amount: '',
        percentage: ''
      })));
    } catch (err) {
      console.error('Error fetching group:', err);
    }
  };

  const handleUserSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const { data } = await expenseApi.searchUsers(query);
      // Filter out already selected users
      const filtered = data.filter(u => !selectedUsers.find(s => s._id === u._id));
      setSearchResults(filtered);
    } catch (err) {
      console.error('Error searching users:', err);
    }
  };

  const addUser = (user) => {
    setSelectedUsers([...selectedUsers, user]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeUser = (userId) => {
    setSelectedUsers(selectedUsers.filter(u => u._id !== userId));
  };

  const handleShareChange = (index, field, value) => {
    const updated = [...participantShares];
    updated[index][field] = value;
    setParticipantShares(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let participants = [];

      if (splitType === 'equal') {
        if (selectedGroup) {
          participants = groupMembers.map(m => ({ userId: m._id }));
        } else {
          const currentUser = JSON.parse(localStorage.getItem('user'));
          participants = [
            { userId: currentUser.id },
            ...selectedUsers.map(u => ({ userId: u._id }))
          ];
        }
      } else if (splitType === 'exact') {
        participants = participantShares
          .filter(p => parseFloat(p.amount) > 0)
          .map(p => ({ userId: p.userId, amount: parseFloat(p.amount) }));
      } else if (splitType === 'percentage') {
        participants = participantShares
          .filter(p => parseFloat(p.percentage) > 0)
          .map(p => ({ userId: p.userId, percentage: parseFloat(p.percentage) }));
      }

      await expenseApi.create({
        groupId: selectedGroup || undefined,
        description,
        amount: parseFloat(amount),
        splitType,
        date,
        participants
      });

      // Reset form
      setDescription('');
      setAmount('');
      setSplitType('equal');
      setDate(new Date().toISOString().split('T')[0]);
      setSelectedUsers([]);
      setParticipantShares([]);
      
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add expense');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const exactTotal = participantShares.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
  const percentageTotal = participantShares.reduce((acc, p) => acc + (parseFloat(p.percentage) || 0), 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Add Expense</h2>
        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Group Selection */}
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Group (optional)</label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full p-3 border rounded"
            >
              <option value="">No group - select users manually</option>
              {groups.map(g => (
                <option key={g._id} value={g._id}>{g.name}</option>
              ))}
            </select>
          </div>

          {/* User Search (when no group selected) */}
          {!selectedGroup && (
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Split with</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleUserSearch(e.target.value)}
                className="w-full p-3 border rounded"
                placeholder="Search users by name or email..."
              />
              {searchResults.length > 0 && (
                <div className="border rounded mt-1 max-h-32 overflow-y-auto">
                  {searchResults.map(user => (
                    <div
                      key={user._id}
                      onClick={() => addUser(user)}
                      className="p-2 hover:bg-gray-100 cursor-pointer"
                    >
                      {user.name} ({user.email})
                    </div>
                  ))}
                </div>
              )}
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedUsers.map(user => (
                    <span
                      key={user._id}
                      className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded flex items-center gap-1"
                    >
                      {user.name}
                      <button
                        type="button"
                        onClick={() => removeUser(user._id)}
                        className="text-indigo-600 hover:text-indigo-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 border rounded"
              placeholder="What was this expense for?"
              required
            />
          </div>

          {/* Amount */}
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Amount</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-3 border rounded"
              placeholder="0.00"
              required
            />
          </div>

          {/* Date */}
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full p-3 border rounded"
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* Split Type */}
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Split Type</label>
            <select
              value={splitType}
              onChange={(e) => setSplitType(e.target.value)}
              className="w-full p-3 border rounded"
            >
              <option value="equal">Equal - Split evenly</option>
              <option value="exact">Exact - Specify amounts</option>
              <option value="percentage">Percentage - Specify percentages</option>
            </select>
          </div>

          {/* Exact Split */}
          {splitType === 'exact' && participantShares.length > 0 && (
            <div className="mb-4 bg-gray-50 p-3 rounded">
              <label className="block text-gray-700 mb-2">How much does each person owe?</label>
              {participantShares.map((p, i) => (
                <div key={p.userId} className="flex items-center gap-2 mb-2">
                  <span className="w-28 truncate">{p.name}</span>
                  <span>$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={p.amount}
                    onChange={(e) => handleShareChange(i, 'amount', e.target.value)}
                    className="flex-1 p-2 border rounded"
                    placeholder="0.00"
                  />
                </div>
              ))}
              <div className="pt-2 border-t flex justify-between font-medium">
                <span>Total:</span>
                <span className={exactTotal > parseFloat(amount || 0) ? 'text-red-600' : 'text-green-600'}>
                  ${exactTotal.toFixed(2)} / ${parseFloat(amount || 0).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Percentage Split */}
          {splitType === 'percentage' && participantShares.length > 0 && (
            <div className="mb-4 bg-gray-50 p-3 rounded">
              <label className="block text-gray-700 mb-2">What percentage does each person owe?</label>
              {participantShares.map((p, i) => (
                <div key={p.userId} className="flex items-center gap-2 mb-2">
                  <span className="w-28 truncate">{p.name}</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={p.percentage}
                    onChange={(e) => handleShareChange(i, 'percentage', e.target.value)}
                    className="flex-1 p-2 border rounded"
                    placeholder="0"
                  />
                  <span>%</span>
                  <span className="text-gray-500 text-sm w-16 text-right">
                    ${((parseFloat(amount || 0) * (parseFloat(p.percentage) || 0)) / 100).toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="pt-2 border-t flex justify-between font-medium">
                <span>Total:</span>
                <span className={percentageTotal > 100 ? 'text-red-600' : 'text-green-600'}>
                  {percentageTotal}% / 100%
                </span>
              </div>
            </div>
          )}

          {/* Equal Split Preview */}
          {splitType === 'equal' && amount && (selectedGroup || selectedUsers.length > 0) && (
            <div className="mb-4 bg-blue-50 p-3 rounded text-sm">
              <p className="font-medium text-blue-800">Equal Split Preview:</p>
              <p className="text-blue-600">
                {selectedGroup 
                  ? `Each of ${groupMembers.length} members pays: $${(parseFloat(amount) / groupMembers.length).toFixed(2)}`
                  : `Each of ${selectedUsers.length + 1} people pays: $${(parseFloat(amount) / (selectedUsers.length + 1)).toFixed(2)}`
                }
              </p>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (!selectedGroup && selectedUsers.length === 0)}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
