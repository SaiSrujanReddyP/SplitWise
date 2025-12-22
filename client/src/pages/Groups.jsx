import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { groups as groupApi } from '../services/api';

export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const { data } = await groupApi.getAll();
      // Handle both paginated { data: [...] } and direct array responses
      const groupData = data?.data || data;
      setGroups(Array.isArray(groupData) ? groupData : []);
    } catch (err) {
      console.error('Error fetching groups:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (creating) return; // Prevent double submission
    setError('');
    setCreating(true);
    try {
      await groupApi.create(newGroupName, []);
      setNewGroupName('');
      setShowModal(false);
      fetchGroups();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteGroup = async (groupId, groupName) => {
    if (!confirm(`Are you sure you want to delete "${groupName}"?`)) return;
    try {
      await groupApi.delete(groupId);
      fetchGroups();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete group');
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Groups</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
        >
          Create Group
        </button>
      </div>

      {groups.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <div
              key={group._id}
              className="bg-white p-6 rounded-lg shadow hover:shadow-md transition relative"
            >
              <Link to={`/groups/${group._id}`}>
                <h3 className="text-lg font-semibold mb-2">{group.name}</h3>
                <p className="text-gray-600">{group.members.length} members</p>
                <p className="text-sm text-gray-500 mt-2">
                  Created by {group.createdBy?.name}
                </p>
              </Link>
              <button
                onClick={() => handleDeleteGroup(group._id, group.name)}
                className="absolute top-2 right-2 text-gray-400 hover:text-red-600 p-1"
                title="Delete group"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No groups yet</p>
          <button
            onClick={() => setShowModal(true)}
            className="text-indigo-600 hover:underline"
          >
            Create your first group
          </button>
        </div>
      )}

      {/* Create Group Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create Group</h2>
            {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
            <form onSubmit={handleCreateGroup}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Group Name</label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
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
                  disabled={creating}
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
