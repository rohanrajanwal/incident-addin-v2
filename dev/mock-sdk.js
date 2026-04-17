/* ========================================
   Mock Geotab SDK for Local Development
   Simulates api.call(), api.multiCall(), and state
   ======================================== */

const MOCK_SCENARIOS = {
  'collision-major': {
    device: {
      id: 'b1234',
      name: 'Vehicle-201',
      vehicleIdentificationNumber: '1GCGG25K081234567',
      deviceType: 'GO9',
      serialNumber: 'G9-001-002-0034'
    },
    driver: {
      id: 'aUser123',
      name: 'Lucas Johnson',
      employeeNo: 'EMP-4421'
    },
    logRecords: [
      { latitude: 40.6815, longitude: -75.5948, speed: 55, dateTime: '2025-10-04T18:28:00Z' },
      { latitude: 40.6813, longitude: -75.5945, speed: 45, dateTime: '2025-10-04T18:29:00Z' },
      { latitude: 40.6811, longitude: -75.5943, speed: 32, dateTime: '2025-10-04T18:29:30Z' },
      { latitude: 40.6810, longitude: -75.5942, speed: 12, dateTime: '2025-10-04T18:29:55Z' },
      { latitude: 40.6810, longitude: -75.5942, speed: 0,  dateTime: '2025-10-04T18:30:02Z' }
    ],
    exceptions: [{
      id: 'aExc001',
      rule: { id: 'aCollisionDetectionMajor', name: 'Major Collision Detection' },
      device: { id: 'b1234' },
      driver: { id: 'aUser123' },
      activeFrom: '2025-10-04T18:30:00Z',
      activeTo: '2025-10-04T18:30:02Z',
      state: 'Valid'
    }],
    statusData: [
      {
        data: -8.2,
        dateTime: '2025-10-04T18:30:00Z',
        diagnostic: { id: 'DiagnosticAccelerometerForwardBrakingId', name: 'Accelerometer - Forward Braking' }
      },
      {
        data: -4.1,
        dateTime: '2025-10-04T18:30:01Z',
        diagnostic: { id: 'DiagnosticAccelerometerForwardBrakingId', name: 'Accelerometer - Forward Braking' }
      }
    ],
    location: 'Interstate 78, Mile Marker 47',
    weather: { condition: 'Clear', temperature: 72, road: 'Dry' }
  },

  'collision-minor': {
    device: {
      id: 'b5678',
      name: 'Fleet-Truck-88',
      vehicleIdentificationNumber: '1FTFW1ET5DFC10042',
      deviceType: 'GO9'
    },
    driver: {
      id: 'aUser456',
      name: 'Sarah Rodriguez',
      employeeNo: 'EMP-7832'
    },
    logRecords: [
      { latitude: 34.0522, longitude: -118.2437, speed: 15, dateTime: '2025-10-04T10:15:00Z' },
      { latitude: 34.0521, longitude: -118.2436, speed: 5, dateTime: '2025-10-04T10:15:30Z' },
      { latitude: 34.0521, longitude: -118.2436, speed: 0, dateTime: '2025-10-04T10:15:45Z' }
    ],
    exceptions: [{
      id: 'aExc002',
      rule: { id: 'aCollisionDetectionMinor', name: 'Minor Collision Detection' },
      device: { id: 'b5678' },
      driver: { id: 'aUser456' },
      activeFrom: '2025-10-04T10:15:40Z',
      activeTo: '2025-10-04T10:15:45Z',
      state: 'Valid'
    }],
    statusData: [{
      data: -2.8,
      dateTime: '2025-10-04T10:15:40Z',
      diagnostic: { id: 'DiagnosticAccelerometerForwardBrakingId' }
    }],
    location: 'Loading Dock, Warehouse District',
    weather: { condition: 'Overcast', temperature: 65, road: 'Dry' }
  },

  'no-third-party': {
    device: {
      id: 'b9999',
      name: 'Delivery-Van-12',
      vehicleIdentificationNumber: '2C4RDGCG5HR501234',
      deviceType: 'GO9'
    },
    driver: {
      id: 'aUser789',
      name: 'Mike Chen',
      employeeNo: 'EMP-2211'
    },
    logRecords: [
      { latitude: 41.8781, longitude: -87.6298, speed: 8, dateTime: '2025-10-04T09:00:00Z' },
      { latitude: 41.8781, longitude: -87.6298, speed: 0, dateTime: '2025-10-04T09:00:10Z' }
    ],
    exceptions: [{
      id: 'aExc003',
      rule: { id: 'aCollisionDetectionMinor', name: 'Minor Collision Detection' },
      device: { id: 'b9999' },
      driver: { id: 'aUser789' },
      activeFrom: '2025-10-04T09:00:08Z',
      activeTo: '2025-10-04T09:00:10Z',
      state: 'Valid'
    }],
    statusData: [{
      data: -1.5,
      dateTime: '2025-10-04T09:00:08Z',
      diagnostic: { id: 'DiagnosticAccelerometerForwardBrakingId' }
    }],
    location: 'Parking Garage B, Level 2',
    weather: { condition: 'Rain', temperature: 58, road: 'Wet' }
  }
};

function createMockApi(scenario) {
  const data = MOCK_SCENARIOS[scenario] || MOCK_SCENARIOS['collision-major'];

  const api = {
    _isMock: true,
    _scenario: scenario,
    _callLog: [],

    call(method, params) {
      return new Promise((resolve) => {
        const delay = 100 + Math.random() * 200; // Simulate network
        setTimeout(() => {
          this._callLog.push({ method, params, timestamp: Date.now() });
          console.log(`[Mock API] ${method}(${params.typeName})`, params);

          if (method === 'Get') {
            switch (params.typeName) {
              case 'Device':
                resolve([data.device]);
                break;
              case 'User':
                resolve([data.driver]);
                break;
              case 'LogRecord':
                resolve(data.logRecords);
                break;
              case 'ExceptionEvent':
                resolve(data.exceptions);
                break;
              case 'StatusData':
                resolve(data.statusData);
                break;
              default:
                resolve([]);
            }
          } else if (method === 'Add') {
            console.log(`[Mock API] Add ${params.typeName}:`, params.entity);
            resolve({ id: 'mock-' + Date.now() });
          } else {
            resolve([]);
          }
        }, delay);
      });
    },

    multiCall(calls) {
      console.log(`[Mock API] multiCall with ${calls.length} calls`);
      return Promise.all(
        calls.map(([method, params]) => this.call(method, params))
      );
    }
  };

  const state = {
    device: data.device,
    driver: data.driver,
    driving: false
  };

  return { api, state, mockData: data };
}
