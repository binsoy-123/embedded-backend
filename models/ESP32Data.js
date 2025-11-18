const mongoose = require('mongoose');

const esp32DataSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true
  },
  sizeDetected: {
    type: String,
    enum: ['Unknown', 'Small', 'Medium', 'Large'],
    required: true,
    default: 'Unknown'
  },
  sensorReadings: {
    small: Boolean,
    medium: Boolean,
    large: Boolean
  },
  motorStatus: {
    small: Boolean,
    medium: Boolean,
    large: Boolean
  },
  ledStatus: Boolean,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ESP32Data', esp32DataSchema);