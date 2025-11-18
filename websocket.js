const WebSocket = require('ws');
const ESP32Data = require('./models/ESP32Data');

// Track ESP32 connection
let esp32Client = null;

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log('New WebSocket connection');

    // Identify if this is ESP32 or web client
    // ESP32 will send sensor data, web clients will send commands
    let isESP32 = false;

    // Send initial system status to web clients
    sendSystemStatus(ws);

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);

        // Check if this is an ESP32 (sends deviceId or sensors data)
        if (data.deviceId || data.sensors) {
          isESP32 = true;
          esp32Client = ws;
          console.log('ESP32 identified and connected');

          // Handle ESP32 sensor data
          let deviceId = data.deviceId || data.device_id || 'esp32';
          let lastDetectedSize = data.lastDetectedSize || data.detectedSize || data.lastDetected || 0;

          // Determine sensor booleans (true = detected)
          const sensorReadings = {
            small: false,
            medium: false,
            large: false
          };

          if (data.sensors) {
            // sensors may be numeric (0 = LOW = detected) or boolean
            sensorReadings.small = (typeof data.sensors.small === 'number') ? (data.sensors.small === 0) : !!data.sensors.small;
            sensorReadings.medium = (typeof data.sensors.medium === 'number') ? (data.sensors.medium === 0) : !!data.sensors.medium;
            sensorReadings.large = (typeof data.sensors.large === 'number') ? (data.sensors.large === 0) : !!data.sensors.large;
          } else {
            // flat properties from sketch: small/medium/large are booleans where true = detected
            if (typeof data.small !== 'undefined') sensorReadings.small = !!data.small;
            if (typeof data.medium !== 'undefined') sensorReadings.medium = !!data.medium;
            if (typeof data.large !== 'undefined') sensorReadings.large = !!data.large;
          }

          const motorStatus = {
            small: data.motors ? !!data.motors.small : false,
            medium: data.motors ? !!data.motors.medium : false,
            large: data.motors ? !!data.motors.large : false
          };

          const esp32Data = new ESP32Data({
            deviceId,
            sizeDetected: getSizeLabel(lastDetectedSize),
            sensorReadings,
            motorStatus,
            ledStatus: !!data.ledStatus
          });

          await esp32Data.save();

          // Broadcast updated status to all web clients (not ESP32)
          broadcastToWebClients(wss, {
            type: 'status',
            data: esp32Data
          });
        } 
        // Check if this is a motor command from web client
        else if (data.command) {
          console.log('Motor command received from web client:', data.command);

          // Forward command to ESP32
          if (esp32Client && esp32Client.readyState === WebSocket.OPEN) {
            esp32Client.send(JSON.stringify(data));
            console.log('Command forwarded to ESP32');
          } else {
            console.log('ESP32 not connected, cannot send command');
          }
        }
      } catch (err) {
        console.error('WebSocket error:', err);
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected');
      if (ws === esp32Client) {
        console.log('ESP32 connection closed');
        esp32Client = null;
      }
    });
  });

  return wss;
}

// Helper function to convert size number to label
function getSizeLabel(size) {
  switch(parseInt(size)) {
    case 1: return 'Small';
    case 2: return 'Medium';
    case 3: return 'Large';
    default: return 'Unknown';
  }
}

// Helper function to send system status
async function sendSystemStatus(ws) {
  try {
    const latestData = await ESP32Data.findOne().sort({ timestamp: -1 });
    if (latestData && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'status',
        data: latestData
      }));
    }
  } catch (err) {
    console.error('Error sending system status:', err);
  }
}

// Helper function to broadcast status to all web clients (not ESP32)
async function broadcastToWebClients(wss, message) {
  try {
    wss.clients.forEach((client) => {
      // Don't send back to ESP32 client
      if (client !== esp32Client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  } catch (err) {
    console.error('Error broadcasting to web clients:', err);
  }
}

module.exports = setupWebSocket;