const express = require('express');
const router = express.Router();
const checkAuth = require('../middleware/check-auth');
const dashboardController = require('../controllers/dashboard');

// 업데이트 시간 체크
router.get('/', checkAuth, dashboardController.updateTime);

// 데이터 새로고침
router.patch('/', checkAuth, dashboardController.refreshData);

// 관심이 가장 많은 게시물
router.get('/interest', checkAuth, dashboardController.interest);

// 전체 게시물
router.get('/allposts', checkAuth, dashboardController.allposts);

module.exports = router;
