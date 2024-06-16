const express = require('express');
const router = express.Router();
const checkAuth = require('../middleware/check-auth');
const userController = require('../controllers/user');

// sns 계정연동
router.get('/snsAccountLink', checkAuth, userController.snsAccountList);
router.post('/snsAccountLink', checkAuth, userController.snsAccountLink);
router.delete('/snsAccountLink', checkAuth, userController.snsAccountDelete);
router.post('/snsAccountLink/user', checkAuth, userController.snsAccountUser);

module.exports = router;
