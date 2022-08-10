#!/usr/bin/env node
'use strict';

import { default as Canvas } from 'canvas';
import { default as Chartjs } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { default as clog } from 'ee-log';
import { default as Hjson } from 'hjson';
import { default as fs } from 'fs';
import { default as child_process } from 'child_process';
import { writeFile } from 'fs/promises';
import { readFileSync } from 'fs';
import { default as readline } from 'readline';

console.log(`--- Logs begin at ${new Date().toUTCString()} ---`)

// path relative to repo root
const astfpyPath = 'pyastf/astf.py'

const profiles = Hjson.parse(readFileSync('profiles/test01.hjson').toString());

for (let i = 0; i < profiles.length; i++) {
  const prof = profiles[i];
  clog.info('Spawning profile', prof.name);
  clog.debug('Profile config', prof);

  const child = child_process.spawnSync(
    astfpyPath,
    [
      '-r', `${prof.server}`,
      '-m', `${prof.mult}`,
      '-d', `${prof.duration}`,
      '-f', `trex-core/scripts/${prof.file}`,
      '-s', `${prof.sleep}`
    ],
    {
      stdio: ['ignore', 'pipe', 'inherit'],
    }
  );

  const data = {
    datasets: [{
      label: 'tx_bps',
      borderColor: "rgb(88, 107, 164)",
      backgroundColor: "rgba(88, 107, 164, 0.2)",
      fill: 1,
      tension: 0.1,
      data: [],
    },
    {
      label: 'rx_bps',
      borderColor: "rgb(245, 221, 144)",
      backgroundColor: "rgba(245, 221, 144, 0.2)",
      fill: 2,
      tension: 0.1,
      data: [],
    },
    {
      label: 'rx_drop_bps',
      borderColor: "rgb(247, 108, 94)",
      backgroundColor:"rgba(247, 108, 94, 0.2)",
      fill: 'origin',
      tension: 0.1,
      data: [],
    }]
  };

  const stdout = child.stdout.toString().split('\n');
  for (let j = 0; j < stdout.length; j++) {
    var input = stdout[j].toString();
    if (input != '') {
      input = JSON.parse(input);
      const timestamp = new Date(input.timestamp);
      const hours = timestamp.getHours();
      const minutes = "0" + timestamp.getMinutes();
      const seconds = "0" + timestamp.getSeconds();
      const displayTime = `${hours}:${minutes}:${seconds}`;
    
      const tx_bps = input.stats.global.tx_bps / 1000000;
      const rx_bps = input.stats.global.rx_bps / 1000000;
      const rx_drop_bps = input.stats.global.rx_drop_bps / 1000000;
    
      data.datasets[0].data.push({
        x: displayTime,
        y: tx_bps
      });
      data.datasets[1].data.push({
        x: displayTime,
        y: rx_bps
      });
      data.datasets[2].data.push({
        x: displayTime,
        y: rx_drop_bps
      });
    }
  }

  const graphTitle = `m:${prof.mult} d:${prof.duration} f:${prof.file}`;

  const config = {
    type: 'line',
    data: data,
    options: {
      plugins: {
        title: {
          display: true,
          text: graphTitle,
          font: {
            family: "monospace",
            size: 16,
          }
        },
        legend: {
          position: 'top',
          align: 'left',
          labels: {
            boxWidth: 14,
            boxHeight: 14,
            font: {
              family: "monospace",
              size: 12,
            }
          }
        }
      },
      elements: {
        point: {
          radius: 0
        }
      },
      scales: {
        x: {
        },
        y: {
          position: 'right',
          type: 'linear',
          suggestedMin: '20',
          title: {
            text: 'Mbps',
            display: true
          }
        }
      }
    },
    layout: {
      padding: {
        top: 20,
        right: 20,
        left: 20,
        bottom: 20
      }
    },
  };
    const canvas = Canvas.createCanvas(2400,800)
  const ctx = canvas.getContext('2d')
    const myChart = new Chartjs.Chart(
    ctx,
    config
  );
    const b64Data = myChart.toBase64Image();
  const b64Image = b64Data.replace(/^data:image\/\w+;base64,/, '');

  const timestamp = new Date();

  writeFile(`graphs/${prof.name}-mult_${prof.mult}-dur_${prof.duration}-sleep_${prof.sleep}-${timestamp.toISOString().replace(':', '.')}.png`, b64Image, {encoding: 'base64'});
}
