const express = require('express');
const prometheus = require('prom-client');
const cors = require('cors');
const bodyParser = require('body-parser');
const os = require('os-utils');
const df = require('node-df');
const _os = require('os');
const humanize = require('humanize');
const batteryLevel = require('battery-level');
const osu = require('node-os-utils');
const si = require('systeminformation');

const cpu = osu.cpu;
const app = express();
app.use(cors())

const port = 9091;
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.send('Hello from the server!')
});

let cpuUsageVal = 0;

let totalSize = 0;
let totalUsed = 0;
let currentStorage = 0;

let designedCapacity = 0;
let maxCapacity = 0;
let currentCapacity = 0;
let capacityUnit = '';

let frequency = 0;

let cpuSpeed = 0;
let speedMin = 0;
let speedMax = 0;

let cpuTemperature = 0;
let cpuTemperatureMin = 0;
let cpuTemperatureMax = 0;

let dataTransferred = 0;
let dataReceived = 0;

let rIO = 0;
let wIO = 0;
let tIO = 0;

const getMetrics = () => {
  cpu.usage()
    .then(response => {
      cpuUsageVal = response;
    })

  df(function (error, response) {
    if (error) { throw error; }
    for (const drive of response) {
      totalSize += drive.size;
      totalUsed += drive.used;
    }
    currentStorage = totalUsed * 100 / totalSize;
  });

  si.battery().then((bat) => {
    designedCapacity = bat.designedCapacity;
    maxCapacity = bat.maxCapacity;
    currentCapacity = bat.currentCapacity
    capacityUnit = bat.capacityUnit;
  }).catch((err) => {
    console.error(err);
  });

  si.wifiNetworks().then((wifi) => {
    frequency = wifi[0]?.frequency || 0;
  }).catch((err) => {
    console.error(err);
  });

  si.cpu().then((cpu) => {
    cpuSpeed = cpu.speed;
    speedMin = cpu.speedMin;
    speedMax = cpu.speedMax;
  }).catch((err) => {
    console.error(err);
  })

  si.cpuTemperature().then((data) => {
    cpuTemperature = Math.max(...data.cores);
    cpuTemperatureMin = Math.min(...data.cores);;
    cpuTemperatureMax = data.max;
  }).catch((err) => {
    console.error(err);
  })

  si.networkStats().then(data => {
    dataTransferred = data[0].tx_sec / 125;
    dataReceived = data[0].rx_sec / 125;
  })

  si.disksIO().then(data => {
    rIO = data.rIO * Math.pow(10, -6);
    wIO = data.wIO * Math.pow(10, -6);
    tIO = data.tIO * Math.pow(10, -6);
  });

  const localLiveMonitoring = {

    "systemMetrics": {
      "metrics": {
        "cpu": {
          "label": "CPU",
          "unit": "%",
          "min": 3,
          "med": 50,
          "max": 100,
          "current": +(`${cpuUsageVal}`)
        },
        "cpuTemperature": {
          "label": "CPU Temperature",
          "unit": "°C",
          "min": cpuTemperatureMin,
          "med": (cpuTemperatureMin + cpuTemperatureMax) / 2,
          "max": cpuTemperatureMax,
          "current": cpuTemperature
        },
        "storage": {
          "label": "Storage",
          "unit": "%",
          "min": 2,
          "med": 50,
          "max": 100,
          "current": currentStorage
        },
        "ram": {
          "label": "RAM",
          "unit": "GB",
          "min": +((_os.totalmem() / 10 / 1024 / 1024 / 1024).toFixed(2)),
          "med": +((_os.totalmem() / 2 / 1024 / 1024 / 1024).toFixed(2)),
          "max": +((_os.totalmem() / 1024 / 1024 / 1024).toFixed(2)),
          "current": +(((_os.totalmem() - _os.freemem()) / 1024 / 1024 / 1024).toFixed(2))
        },
        "wifiFrequency": {
          "label": "wifiFrequency",
          "unit": "MHz",
          "min": 0,
          "med": 2437,
          "max": 6000,
          "current": frequency
        }
      },
      "layer": {
        "systemMetrics-layer": {
          "label": os.platform() + " System metrics",
          "_layerBehavior": "something",
          "_defaultColor": "green",
          "_publicColorOption": "random calls function to pick a color",
        },
      },
    },
    "qosMetrics": {
      "metrics": {
        "totalDataReceived": {
          "label": "Data Received",
          "unit": "KB / seconds",
          "min": 0,
          "med": 10000,
          "max": 100000,
          "current": dataReceived
        },
        "totalDataTransferred": {
          "label": "Data Transferred",
          "unit": "KB / seconds",
          "min": 0,
          "med": 10000,
          "max": 100000,
          "current": dataTransferred
        },
        /* "battery": {
            "label": "Battery Capacity",
            "unit": capacityUnit,
            "min": maxCapacity * 0.1,
            "med": designedCapacity,
            "max": maxCapacity,
            "current": currentCapacity
        }, */
        "cpuSpeed": {
          "label": "CPU Speed",
          "unit": "GHz",
          "min": speedMin,
          "med": (speedMax + speedMin) / 2,
          "max": speedMax,
          "current": cpuSpeed
        },
        "readIOPS": {
          "label": "read Input/Output operations",
          "unit": "MB / second",
          "min": 0,
          "med": tIO / 2,
          "max": tIO,
          "current": rIO
        },
        "writeIOPS": {
          "label": "write Input/Output operations ",
          "unit": "MB / second",
          "min": 0,
          "med": wIO * 2,
          "max": wIO * 3,
          "current": wIO
        },
        /* "ioSpeed": {
         "label": "ioSpeed",
         "unit": "MB / seconds",
         "min": os.processUptime().toFixed(2),
         "med": os.processUptime().toFixed(2)*5,
         "max": os.processUptime().toFixed(2)*10,
         "current": os.processUptime().toFixed(2)*3
       } */
      },
      "layer": {
        "qosMetrics-layer": {
          "label": os.platform() + " Qos metrics",
        }
      }
    }
  };
  return localLiveMonitoring;
}

app.get('/dataSys', async (req, res) => {
  cpu.usage()
    .then(response => {
      cpuUsageVal = response;
    })

  df(function (error, response) {
    if (error) { throw error; }
    for (const drive of response) {
      totalSize += drive.size;
      totalUsed += drive.used;
    }
    currentStorage = totalUsed * 100 / totalSize;
  });

  si.battery().then((bat) => {
    designedCapacity = bat.designedCapacity;
    maxCapacity = bat.maxCapacity;
    currentCapacity = bat.currentCapacity
    capacityUnit = bat.capacityUnit;
  }).catch((err) => {
    console.error(err);
  });

  si.wifiNetworks().then((wifi) => {
    frequency = wifi[0]?.frequency || 0;
  }).catch((err) => {
    console.error(err);
  });

  si.cpu().then((cpu) => {
    cpuSpeed = cpu.speed;
    speedMin = cpu.speedMin;
    speedMax = cpu.speedMax;
  }).catch((err) => {
    console.error(err);
  })

  si.cpuTemperature().then((data) => {
    cpuTemperature = Math.max(...data.cores);
    cpuTemperatureMin = Math.min(...data.cores);;
    cpuTemperatureMax = data.max;
  }).catch((err) => {
    console.error(err);
  })

  si.networkStats().then(data => {
    dataTransferred = data[0].tx_sec / 125;
    dataReceived = data[0].rx_sec / 125;
  })

  si.disksIO().then(data => {
    rIO = data.rIO * Math.pow(10, -6);
    wIO = data.wIO * Math.pow(10, -6);
    tIO = data.tIO * Math.pow(10, -6);
  });

  const localLiveMonitoring = {

    "systemMetrics": {
      "metrics": {
        "cpu": {
          "label": "CPU",
          "unit": "%",
          "min": 3,
          "med": 50,
          "max": 100,
          "current": +(`${cpuUsageVal}`)
        },
        "cpuTemperature": {
          "label": "CPU Temperature",
          "unit": "°C",
          "min": cpuTemperatureMin,
          "med": (cpuTemperatureMin + cpuTemperatureMax) / 2,
          "max": cpuTemperatureMax,
          "current": cpuTemperature
        },
        "storage": {
          "label": "Storage",
          "unit": "%",
          "min": 2,
          "med": 50,
          "max": 100,
          "current": currentStorage
        },
        "ram": {
          "label": "RAM",
          "unit": "GB",
          "min": +((_os.totalmem() / 10 / 1024 / 1024 / 1024).toFixed(2)),
          "med": +((_os.totalmem() / 2 / 1024 / 1024 / 1024).toFixed(2)),
          "max": +((_os.totalmem() / 1024 / 1024 / 1024).toFixed(2)),
          "current": +(((_os.totalmem() - _os.freemem()) / 1024 / 1024 / 1024).toFixed(2))
        },
        "wifiFrequency": {
          "label": "wifiFrequency",
          "unit": "MHz",
          "min": 0,
          "med": 2437,
          "max": 6000,
          "current": frequency
        }
      },
      "layer": {
        "systemMetrics-layer": {
          "label": os.platform() + " System metrics",
          "_layerBehavior": "something",
          "_defaultColor": "green",
          "_publicColorOption": "random calls function to pick a color",
        },
      },
    },
    "qosMetrics": {
      "metrics": {
        "totalDataReceived": {
          "label": "Data Received",
          "unit": "KB / seconds",
          "min": 0,
          "med": 10000,
          "max": 100000,
          "current": dataReceived
        },
        "totalDataTransferred": {
          "label": "Data Transferred",
          "unit": "KB / seconds",
          "min": 0,
          "med": 10000,
          "max": 100000,
          "current": dataTransferred
        },
        /* "battery": {
            "label": "Battery Capacity",
            "unit": capacityUnit,
            "min": maxCapacity * 0.1,
            "med": designedCapacity,
            "max": maxCapacity,
            "current": currentCapacity
        }, */
        "cpuSpeed": {
          "label": "CPU Speed",
          "unit": "GHz",
          "min": speedMin,
          "med": (speedMax + speedMin) / 2,
          "max": speedMax,
          "current": cpuSpeed
        },
        "readIOPS": {
          "label": "read Input/Output operations",
          "unit": "MB / second",
          "min": 0,
          "med": tIO / 2,
          "max": tIO,
          "current": rIO
        },
        "writeIOPS": {
          "label": "write Input/Output operations ",
          "unit": "MB / second",
          "min": 0,
          "med": wIO * 2,
          "max": wIO * 3,
          "current": wIO
        },
        /* "ioSpeed": {
         "label": "ioSpeed",
         "unit": "MB / seconds",
         "min": os.processUptime().toFixed(2),
         "med": os.processUptime().toFixed(2)*5,
         "max": os.processUptime().toFixed(2)*10,
         "current": os.processUptime().toFixed(2)*3
       } */
      },
      "layer": {
        "qosMetrics-layer": {
          "label": os.platform() + " Qos metrics",
        }
      }
    }
  };

  res.json(localLiveMonitoring);
});



const cpuGauge = new prometheus.Gauge({
  name: 'cpu',
  help: 'CPU',
  labelNames: ['level', 'unit']
});

const cpuTemperatureGauge = new prometheus.Gauge({
  name: 'cpu_temperature',
  help: 'CPU Temperature',
  labelNames: ['level', 'unit']
});

const storageGauge = new prometheus.Gauge({
  name: 'storage',
  help: 'Storage',
  labelNames: ['level', 'unit']
});

const ramGauge = new prometheus.Gauge({
  name: 'ram',
  help: 'RAM',
  labelNames: ['level', 'unit']
});

const wifiFrequencyGauge = new prometheus.Gauge({
  name: 'wifi_frequency',
  help: 'Wifi',
  labelNames: ['level', 'unit']
});

const totalDataReceivedGauge = new prometheus.Gauge({
  name: 'total_data_received',
  help: 'Total data received',
  labelNames: ['level', 'unit']
});

const totalDataTransferredGauge = new prometheus.Gauge({
  name: 'total_data_transferred',
  help: 'Total data transferred',
  labelNames: ['level', 'unit']
});

const cpuSpeedGauge = new prometheus.Gauge({
  name: 'cpu_speed',
  help: 'CPU speed',
  labelNames: ['level', 'unit']
});

const readIOPSGauge = new prometheus.Gauge({
  name: 'read_IOPS',
  help: 'Read IOPS',
  labelNames: ['level', 'unit']
});

const writeIOPSGauge = new prometheus.Gauge({
  name: 'write_IOPS',
  help: 'Write IOPS',
  labelNames: ['level', 'unit']
});

app.get('/metrics', async (req, res) => {
  try {
    const cpuUsageVal = await cpu.usage();
    cpuGauge.set({level: 'min', unit: '%'}, 3);
    cpuGauge.set({level: 'max', unit: '%'}, 50);
    cpuGauge.set({level: 'med', unit: '%'}, 100);
    cpuGauge.set({level: 'current', unit: '%'}, +cpuUsageVal);

    const drives = await new Promise((resolve, reject) => {
      df((error, response) => {
        if (error) reject(error);
        else resolve(response);
      });
    });

    let totalSize = 0;
    let totalUsed = 0;
    for (const drive of drives) {
      totalSize += drive.size;
      totalUsed += drive.used;
    }
    const currentStorage = totalUsed * 100 / totalSize;
    storageGauge.set({level: 'min', unit: '%'}, 2);
    storageGauge.set({level: 'max', unit: '%'}, 50);
    storageGauge.set({level: 'med', unit: '%'}, 100);
    storageGauge.set({level: 'current', unit: '%'}, currentStorage);

    const bat = await si.battery();
    const { designedCapacity, maxCapacity, currentCapacity, capacityUnit } = bat;
    const wifi = await si.wifiNetworks();
    const frequency = wifi[0]?.frequency || 0;
    const cpuInfo = await si.cpu();
    const { speed: cpuSpeed, speedMin, speedMax } = cpuInfo;
    const cpuTemperatureData = await si.cpuTemperature();
    const cpuTemperature = Math.max(...cpuTemperatureData.cores);
    const cpuTemperatureMin = Math.min(...cpuTemperatureData.cores);
    const cpuTemperatureMax = cpuTemperatureData.max;
    const networkStats = await si.networkStats();
    const dataTransferred = networkStats[0].tx_sec / 125;
    const dataReceived = networkStats[0].rx_sec / 125;
    const disksIO = await si.disksIO();
    const rIO = disksIO.rIO * Math.pow(10, -6);
    const wIO = disksIO.wIO * Math.pow(10, -6);
    const tIO = disksIO.tIO * Math.pow(10, -6);

    cpuTemperatureGauge.set({level: 'min', unit: '°C'}, 0);
    cpuTemperatureGauge.set({level: 'max', unit: '°C'}, 50);
    cpuTemperatureGauge.set({level: 'med', unit: '°C'}, 100);
    cpuTemperatureGauge.set({level: 'current', unit: '°C'}, cpuTemperature);

    ramGauge.set({level: 'min', unit: 'GB'}, 0);
    ramGauge.set({level: 'max', unit: 'GB'}, 32);
    ramGauge.set({level: 'med', unit: 'GB'}, 10);
    ramGauge.set({level: 'current', unit: 'GB'}, +(((_os.totalmem() - _os.freemem()) / 1024 / 1024 / 1024).toFixed(2)));

    wifiFrequencyGauge.set({level: 'min', unit: 'MHz'}, 0);
    wifiFrequencyGauge.set({level: 'max', unit: 'MHz'}, 2437);
    wifiFrequencyGauge.set({level: 'med', unit: 'MHz'}, 6000);
    wifiFrequencyGauge.set({level: 'current', unit: 'MHz'}, Math.random() * 100);

    totalDataReceivedGauge.set({level: 'min', unit: 'KB / second'}, 0);
    totalDataReceivedGauge.set({level: 'max', unit: 'KB / second'}, 10000);
    totalDataReceivedGauge.set({level: 'med', unit: 'KB / second'}, 100000);
    totalDataReceivedGauge.set({level: 'current', unit: 'KB / second'}, dataReceived);

    totalDataTransferredGauge.set({level: 'min', unit: 'KB / second'}, 0);
    totalDataTransferredGauge.set({level: 'max', unit: 'KB / second'}, 10000);
    totalDataTransferredGauge.set({level: 'med', unit: 'KB / second'}, 100000);
    totalDataTransferredGauge.set({level: 'current', unit: 'KB / second'}, dataTransferred);

    cpuSpeedGauge.set({level: 'min', unit: 'GHz'}, 0);
    cpuSpeedGauge.set({level: 'max', unit: 'GHz'}, 20);
    cpuSpeedGauge.set({level: 'med', unit: 'GHz'}, 5);
    cpuSpeedGauge.set({level: 'current', unit: 'GHz'}, cpuSpeed);

    readIOPSGauge.set({level: 'min', unit: 'MB / second'}, 0);
    readIOPSGauge.set({level: 'max', unit: 'MB / second'}, tIO);
    readIOPSGauge.set({level: 'med', unit: 'MB / second'}, tIO / 2);
    readIOPSGauge.set({level: 'current', unit: 'MB / second'}, rIO);

    writeIOPSGauge.set({level: 'min', unit: 'MB / second'}, 0);
    writeIOPSGauge.set({level: 'max', unit: 'MB / second'}, wIO * 3);
    writeIOPSGauge.set({level: 'med', unit: 'MB / second'}, wIO * 2);
    writeIOPSGauge.set({level: 'current', unit: 'MB / second'}, wIO);

    res.setHeader('Content-Type', prometheus.register.contentType);
    const metricsData = await prometheus.register.metrics();
    res.status(200).send(metricsData);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});



app.get('/stats', async (req, res) => {
  const timestamp = new Date();

  const level = await batteryLevel();
  const metrics = {
    // Get the platform name
    dateSystem: timestamp.toLocaleString(),
    platformName: os.platform(),
    // Get total memory
    totalMemory: humanize.filesize(_os.totalmem()),
    // Get current free memory
    freeMemory: humanize.filesize(_os.freemem()),
    // Get a percentage reporesentinf the free memory
    freeMemoryPercent: (os.freememPercentage() * 100).toFixed(2) + '%',
    // Get current used memory
    usedMemory: humanize.filesize(_os.totalmem() - _os.freemem()),
    // Get a percentage reporesentinf the used memory
    usedMemoryPercent: ((1 - os.freememPercentage()) * 100).toFixed(2) + '%',
    // Get average load for the 1, 5 or 15 minutes
    loadavg_1_minute: os.loadavg(1),
    loadavg_5_minute: os.loadavg(5),
    loadavg_15_minute: os.loadavg(15),
    // Get the number of miliseconds that the system has been running for.
    sysUptime: os.sysUptime(),
    // Get the number of miliseconds that the process has been running for.
    processUptime: os.processUptime(),
    // Get the battery status
    batteryLevel: `${level * 100}%`,
    // CPU Usage 
    cpuUsagePercent: `${cpuUsageVal}`
  };

  res.json(metrics);
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
