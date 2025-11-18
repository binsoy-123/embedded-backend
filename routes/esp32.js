const express = require('express');
const router = express.Router();
const ESP32Data = require('../models/ESP32Data');

// Get latest system status
router.get('/status', async (req, res) => {
  try {
    const latestData = await ESP32Data.findOne().sort({ timestamp: -1 });
    res.json(latestData || { message: 'No data available' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get historical data with pagination
router.get('/history', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const data = await ESP32Data.find()
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    
    const total = await ESP32Data.countDocuments();
    
    res.json({
      data,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalItems: total
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Post new sensor data from ESP32
router.post('/data', async (req, res) => {
  const esp32Data = new ESP32Data({
    deviceId: req.body.deviceId,
    sizeDetected: req.body.sizeDetected,
    sensorReadings: {
      small: req.body.sensors.small === 0, // LOW (0) means detected
      medium: req.body.sensors.medium === 0,
      large: req.body.sensors.large === 0
    },
    motorStatus: {
      small: req.body.motors.small || false,
      medium: req.body.motors.medium || false,
      large: req.body.motors.large || false
    },
    ledStatus: req.body.ledStatus || false
  });

  try {
    const newData = await esp32Data.save();
    res.status(201).json(newData);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get statistics
router.get('/stats', async (req, res) => {
  try {
    const timeRange = req.query.range || '24h';
    let startDate;
    
    switch(timeRange) {
      case '24h':
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    }

    const stats = await ESP32Data.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: "$sizeDetected",
          count: { $sum: 1 }
        }
      }
    ]);

    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;