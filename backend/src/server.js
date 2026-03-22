const app = require('./app');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 Data file location: ${__dirname}/../data/storage.json`);
    console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
});