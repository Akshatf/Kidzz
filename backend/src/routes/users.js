const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/salespersons', userController.getSalespersons);

module.exports = router;
