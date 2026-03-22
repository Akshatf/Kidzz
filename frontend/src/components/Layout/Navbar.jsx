import React from 'react';
import { NavLink } from 'react-router-dom';
import './Navbar.css';

const Navbar = ({ onLogout, currentUser }) => {
  const isAdmin = currentUser?.role === 'admin';

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <NavLink to="/" className="navbar-brand">
          Shubham kidzz
        </NavLink>
        <ul className="navbar-menu">
          <li><NavLink to="/">{isAdmin ? 'Dashboard' : 'Sales'}</NavLink></li>
          {!isAdmin && <li><NavLink to="/sell">Sell Product</NavLink></li>}
          {isAdmin && <li><NavLink to="/add-product">Add Product</NavLink></li>}
          {isAdmin && <li><NavLink to="/record-purchase">Purchase bill</NavLink></li>}
          {isAdmin && <li><NavLink to="/purchases">Purchase History</NavLink></li>}
          {isAdmin && <li><NavLink to="/due">Due Payments</NavLink></li>}
          <li><NavLink to="/stock-report">Stock Report</NavLink></li>
          <li><NavLink to="/sales-report">Sales Report</NavLink></li>
          <li><span className="user-pill">{currentUser?.name} ({currentUser?.role})</span></li>
          <li><button type="button" className="logout-btn" onClick={onLogout}>Logout</button></li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;