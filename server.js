const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const os = require('os-utils');
const df = require('node-df');
const _os = require('os');
const humanize = require('humanize');
const batteryLevel = require('battery-level');
const osu = require('node-os-utils')
const si = require('systeminformation');

const cpu = osu.cpu;
const app = express();
const corsOptions = {
  origin: true
};
app.use(cors(corsOptions));

const port = 3000;
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.get('/', (req, res) => {
  res.send('Hello from the server!')
});

let cpuUsageVal = 0;
setInterval(function() {
cpu.usage()
  .then(response => {
    cpuUsageVal=response;
  })
}, 1000);

let totalSize = 0;
let totalUsed = 0;
df(function(error, response) {
    if (error) { throw error; }
    for (const drive of response) {
        totalSize += drive.size;
        totalUsed += drive.used;
      }
});

let designedCapacity = 0;
let maxCapacity = 0;
let currentCapacity = 0;
let capacityUnit = '';
setInterval(function() {
si.battery().then((bat) => {
    designedCapacity = bat.designedCapacity;
    maxCapacity = bat.maxCapacity;
    currentCapacity = bat.currentCapacity
    capacityUnit = bat.capacityUnit;
  }).catch((err) => {
    console.error(err);
  });
}, 1000);

  let frequency = 0;
  setInterval(function() {
  si.wifiNetworks().then((wifi) => {
    frequency = wifi[0].frequency || 0;
  }).catch((err) => {
    console.error(err);
  });
}, 1000);

  let pixelDepth = 0;
  setInterval(function() {
  si.graphics().then((graphic) => {
    pixelDepth = graphic.displays[0].pixelDepth;
  }).catch((err) => {
    console.error(err);
  });
}, 1000);
  let cpuSpeed = 0;
  let speedMin = 0;
  let speedMax = 0;
  setInterval(function() {
  si.cpu().then((cpu) => {
    cpuSpeed = cpu.speed;
    speedMin = cpu.speedMin;
    speedMax = cpu.speedMax;
  }).catch((err) => {
    console.error(err);
  })
}, 1000);
  let cpuTemperature = 0;
  let cpuTemperatureMin = 0;
  let cpuTemperatureMax = 0;

  setInterval(function() {
  si.cpuTemperature().then((data) => {
    cpuTemperature = Math.max(...data.cores);
    cpuTemperatureMin = Math.min(...data.cores);;
    cpuTemperatureMax = data.max;
   }).catch((err) => {
    console.error(err);
  })
}, 1000);

let dataTransferred = 0;
let dataReceived = 0;
setInterval(function() {
    si.networkStats().then(data => {
      dataTransferred = data[0].tx_sec / 125;
      dataReceived = data[0].rx_sec / 125;
    })
  }, 1000)

  let rIO = 0;
  let wIO = 0;
  let tIO = 0;
  setInterval(function() {
    si.disksIO().then(data => {
      rIO = data.rIO * Math.pow(10, -6);
      wIO = data.wIO * Math.pow(10, -6);
      tIO = data.tIO * Math.pow(10, -6);
    });
  }, 1000);

app.get('/dataSys', async (req, res) => {

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
              "med": (cpuTemperatureMin + cpuTemperatureMax)/2,
              "max": cpuTemperatureMax,
              "current": cpuTemperature
          },
          "storage": {
              "label": "Storage",
              "unit": "GB",
              "min": +((totalSize*0.02/1024/1024).toFixed(2)),
              "med": +((totalSize/2/1024/1024).toFixed(2)),
              "max": +((totalSize/1024/1024).toFixed(2)),
              "current": +((totalUsed/1024/1024).toFixed(2))
          },
          // the number of bits per pixel on a computer monitor to represent a specific color
          /* "computer display": {
              "label": "computer display",
              "unit": "bits / pixel",
              "min": 1,
              "med": 16,
              "max": 48,
              "current": pixelDepth
          }, */
          "ram": {
            "label": "RAM",
            "unit": "GB",
            "min": +((_os.totalmem()/10/1024/1024/1024).toFixed(2)),
            "med": +((_os.totalmem()/2/1024/1024/1024).toFixed(2)),
            "max": +((_os.totalmem()/1024/1024/1024).toFixed(2)),
            "current": +(((_os.totalmem()-_os.freemem())/1024/1024/1024).toFixed(2))
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
              "label": os.platform()+" System metrics",
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
          "med": (speedMax+speedMin)/2,
          "max": speedMax,
          "current": cpuSpeed 
        },
        "readIOPS": {
          "label": "read Input/Output operations",
          "unit": "MB / second",
          "min": 0,
          "med": tIO/2,
          "max": tIO,
          "current": rIO
        },
        "writeIOPS": {
          "label": "write Input/Output operations ",
          "unit": "MB / second",
          "min": 0,
          "med": wIO*2,
          "max": wIO*3,
          "current": wIO
        },
        /* "availability": {
            "label": "availability",
            "unit": "GB",
            "min": 160,
            "med": 640,
            "max": 1280,
            // "current": 480
            "current": os.loadavg(5)*400
        }, */
        /* "inboundLatency": {
            "label": "inboundLatency",
            "unit": "GB",
            "min": 120,
            "med": 640,
            "max": 1280,
            "current": 620
        },
        "outboundLatency": {
            "label": "outboundLatency",
            "unit": "GB",
            "min": 102,
            "med": 512,
            "max": 1024,
            "current": 450
        }, */
        /*  "ioSpeed": {
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
              "label": os.platform()+" Qos metrics",
              "_layerBehavior": "something",
              "_defaultColor": "green",
              "_publicColorOption": "random calls function to pick a color"
          }
      }
  }
  };
  res.json(localLiveMonitoring);
});

app.get('/stats', async (req, res) => {
            const timestamp = new Date();

            const level = await batteryLevel();
            const metrics = {
                // Get the platform name
                dateSystem: timestamp.toLocaleString(),
                platformName: os.platform(),
                // Get total memory
                totalMemory : humanize.filesize(_os.totalmem()),
                // Get current free memory
                freeMemory: humanize.filesize(_os.freemem()),
                // Get a percentage reporesentinf the free memory
                freeMemoryPercent: (os.freememPercentage()*100).toFixed(2)+'%',
                // Get current used memory
                usedMemory: humanize.filesize(_os.totalmem()-_os.freemem()),
                // Get a percentage reporesentinf the used memory
                usedMemoryPercent: ((1-os.freememPercentage())*100).toFixed(2)+'%',
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

        app.listen(3000, () => {
            console.log(`Server listening on port ${port}`);
          });
