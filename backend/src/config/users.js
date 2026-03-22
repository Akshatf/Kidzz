const USERS = [
    { id: 'admin-1', username: 'admin', password: 'admin@123', role: 'admin', name: 'Administrator' },
    { id: 'sales-1', username: 'sales1', password: 'sales@123', role: 'salesman', name: 'Salesman 1' },
    { id: 'sales-2', username: 'sales2', password: 'sales@123', role: 'salesman', name: 'Salesman 2' }
];

const getSalespersons = () => USERS.filter((u) => u.role === 'salesman');
const getUserById = (id) => USERS.find((u) => u.id === id);

module.exports = {
    USERS,
    getSalespersons,
    getUserById
};
