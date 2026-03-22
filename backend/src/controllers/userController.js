const { getSalespersons } = require('../config/users');

exports.getSalespersons = (req, res) => {
    try {
        const salespersons = getSalespersons().map((user) => ({
            id: user.id,
            username: user.username,
            name: user.name
        }));
        res.json(salespersons);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
