const USERS = [
    { id: 'admin-1', username: 'admin', password: 'admin@123', role: 'admin', name: 'Admin' },
    { id: 'akshat', username: 'akshat', password: 'akshat', role: 'sales', name: 'Akshat' },
    { id: 'anant', username: 'anant', password: 'anant', role: 'sales', name: 'Anant' }
];

const getSalespersons = () => USERS.filter((u) => u.role === 'salesman');
const getUserById = (id) => USERS.find((u) => u.id === id);

module.exports = {
    USERS,
    getSalespersons,
    getUserById
};
