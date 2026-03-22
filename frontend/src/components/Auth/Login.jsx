import React, { useState } from 'react';
import toast from 'react-hot-toast';
import './Login.css';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const success = onLogin(username.trim(), password);
    if (!success) {
      toast.error('Invalid credentials');
      return;
    }
    toast.success('Welcome!');
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Shubham kidzz</h1>
        <p className="login-subtitle">Sign in to continue</p>
        {/* <p className="login-subtitle">
          <strong>Admin:</strong> admin / admin@123
        </p>
        <p className="login-subtitle">
          <strong>Salesman:</strong> sales1 / sales@123 | sales2 / sales@123
        </p> */}
        <form onSubmit={handleSubmit}>
          <label>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            required
          />
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            required
          />
          <button type="submit">Login</button>
        </form>
      </div>
    </div>
  );
};

export default Login;