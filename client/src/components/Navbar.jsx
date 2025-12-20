import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-indigo-600 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-xl font-bold">ExpenseShare</Link>
        <div className="space-x-4">
          {user ? (
            <>
              <Link to="/dashboard" className="hover:text-indigo-200">Dashboard</Link>
              <Link to="/groups" className="hover:text-indigo-200">Groups</Link>
              <Link to="/settlements" className="hover:text-indigo-200">Settlements</Link>
              <span className="text-indigo-200">{user.name}</span>
              <button onClick={handleLogout} className="hover:text-indigo-200">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="hover:text-indigo-200">Login</Link>
              <Link to="/signup" className="hover:text-indigo-200">Signup</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
