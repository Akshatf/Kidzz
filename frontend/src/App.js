import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Navigate, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Layout/Navbar';
// import AddProduct from './components/Products/AddProduct';
import CreateSale from './components/sales/CreateSale';
import PurchaseHistory from './components/Purchase/PurchaseHistory';
import RecordPurchaseBill from './components/Purchase/RecordPurchaseBill';
import DuePayments from './components/Purchase/DuePayments';
import StockReport from './components/Reports/StockReport';
import SalesReport from './components/Reports/SalesReport';
import Login from './components/Auth/Login';
import AdminDashboard from './components/Admin/AdminDashboard';
import { USERS } from './config/users';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const auth = localStorage.getItem('inventory_auth') === 'true';
    const user = localStorage.getItem('inventory_user');
    const parsedUser = user ? JSON.parse(user) : null;

    if (parsedUser && typeof parsedUser.id === 'number') {
      localStorage.removeItem('inventory_auth');
      localStorage.removeItem('inventory_user');
      setIsAuthenticated(false);
      setCurrentUser(null);
      return;
    }

    if (auth && !parsedUser) {
      localStorage.removeItem('inventory_auth');
      setIsAuthenticated(false);
      setCurrentUser(null);
      return;
    }

    setIsAuthenticated(auth);
    setCurrentUser(parsedUser);
  }, []);

  const handleLogin = (username, password) => {
    const user = USERS.find((u) => u.username === username && u.password === password);
    if (user) {
      localStorage.setItem('inventory_auth', 'true');
      localStorage.setItem('inventory_user', JSON.stringify(user));
      setIsAuthenticated(true);
      setCurrentUser(user);
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    localStorage.removeItem('inventory_auth');
    localStorage.removeItem('inventory_user');
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  if (!isAuthenticated) {
    return (
      <>
        <Login onLogin={handleLogin} />
        <Toaster position="top-right" />
      </>
    );
  }

  return (
    <Router>
      <div className="App">
        <Navbar onLogout={handleLogout} currentUser={currentUser} />
        <div className="main-content">
          <Routes>
            <Route
              path="/"
              element={
                currentUser?.role === 'admin' ? (
                  <AdminDashboard currentUser={currentUser} />
                ) : (
                  <CreateSale currentUser={currentUser} />
                )
              }
            />
            <Route path="/sell" element={<CreateSale currentUser={currentUser} />} />
            {/* <Route
              path="/add-product"
              element={currentUser?.role === 'admin' ? <AddProduct /> : <Navigate to="/" replace />}
            /> */}
            <Route
              path="/purchases"
              element={currentUser?.role === 'admin' ? <PurchaseHistory /> : <Navigate to="/" replace />}
            />
            <Route
              path="/record-purchase"
              element={currentUser?.role === 'admin' ? <RecordPurchaseBill /> : <Navigate to="/" replace />}
            />
            <Route
              path="/due"
              element={currentUser?.role === 'admin' ? <DuePayments /> : <Navigate to="/" replace />}
            />
            <Route path="/stock-report" element={<StockReport currentUser={currentUser} />} />
            <Route path="/sales-report" element={<SalesReport currentUser={currentUser} />} />
          </Routes>
        </div>
        <Toaster position="top-right" />
      </div>
    </Router>
  );
}

export default App;