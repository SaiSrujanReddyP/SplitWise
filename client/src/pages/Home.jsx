import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Split Expenses with Friends
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Track shared expenses, settle debts, and keep friendships intact.
          </p>
          {user ? (
            <Link
              to="/dashboard"
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700"
            >
              Go to Dashboard
            </Link>
          ) : (
            <div className="space-x-4">
              <Link
                to="/signup"
                className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700"
              >
                Get Started
              </Link>
              <Link
                to="/login"
                className="bg-white text-indigo-600 px-6 py-3 rounded-lg border border-indigo-600 hover:bg-indigo-50"
              >
                Login
              </Link>
            </div>
          )}
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">Create Groups</h3>
            <p className="text-gray-600">Organize expenses by trips, roommates, or events.</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">Split Expenses</h3>
            <p className="text-gray-600">Equal, exact, or percentage splits supported.</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">Track Balances</h3>
            <p className="text-gray-600">See who owes whom with simplified balances.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
