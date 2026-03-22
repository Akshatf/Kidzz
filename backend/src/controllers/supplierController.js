const storage = require('../services/storageService');

exports.listSuppliers = (req, res) => {
    try {
        const rows = storage.getSuppliers();
        res.json([...rows].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createSupplier = (req, res) => {
    try {
        const name = String(req.body.name || '').trim();
        if (!name) {
            return res.status(400).json({ error: 'Supplier name is required' });
        }
        const rows = storage.getSuppliers();
        const existing = rows.find((s) => s.name.toLowerCase() === name.toLowerCase());
        if (existing) {
            return res.status(200).json(existing);
        }
        const row = storage.saveSupplier({
            name,
            created_at: new Date().toISOString()
        });
        res.status(201).json(row);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
