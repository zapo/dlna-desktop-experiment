#!/usr/bin/env node

const readline = require('readline');
const MediaRendererClient = require('upnp-mediarenderer-client');
const SSDPClient = require('node-ssdp').Client;
const http = require('http');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');

// FIXME: Use properly generated tempfiles
const TMP = '/tmp/video.mp4';

const FFMPEG_ARGS = `-y -f x11grab -show_region 1 -s 1920x1080 -r 60 -i :0.0+0,0 -vcodec libx264 -pix_fmt yuv420p -preset ultrafast -tune zerolatency -f mpegts ${TMP}`

const recording = execFile('ffmpeg', FFMPEG_ARGS.split(' '));
const proxy = http.createServer((req, res) => {
  const readStream = fs.createReadStream(TMP);

  res.writeHead(200, {
    'Content-Type': 'video/mp4',
    'Transfer-Encoding': 'chunked'
  });

  readStream.on('data', function(data) {
    res.write(data);
  });

  readStream.on('close', function() {
    res.end();
  });
});

// Yolo, y'all can access my desktop
proxy.listen(8080, '0.0.0.0');

const interfaces = Object.entries(os.networkInterfaces())
  .filter(([name, info]) => info.some((address) => !address.internal))
  .map(([name, _]) => name);

console.log('Found interfaces:', interfaces.join(', '))

const ssdp = new SSDPClient({
  interfaces,
  explicitSocketBind: true
});

const renderers = {};

const COMMANDS = {
  HELP: { name: 'help', call: help },
  LIST: { name: 'list', call: list },
  PAUSE: { name: 'pause', call: pause },
  PLAY: { name: 'play', call: play },
  STOP: { name: 'stop', call: stop },
  QUIT: { name: 'quit', call: quit },
  RESUME: { name: 'resume', call: resume },
  SEARCH: { name: 'search', call: search },
};

const COMMAND_NAMES = Object.values(COMMANDS).map((c) => c.name);
const COMMAND_DISPATCH = Object.values(COMMANDS).reduce((memo, cmd) => {
  memo[cmd.name] = cmd.call;
  return memo;
}, {});

function completer(line) {
  const completions = COMMAND_NAMES.concat(Object.keys(renderers));
  let cmds = line.split(' ');
  const hits = completions.filter((c) => c.startsWith(cmds.slice(-1)));

  if ((cmds.length > 1) && (hits.length === 1)) {
    let lastCmd = cmds.slice(-1)[0];
    let pos = lastCmd.length;
    rl.line = line.slice(0, -pos).concat(hits[0]);
    rl.cursor = rl.line.length + 1;
  }

  return [hits.length ? hits.sort() : completions.sort(), line];
}

const rl = readline.createInterface({
  completer,
  prompt: '> ',
  input: process.stdin,
  output: process.stdout,
  terminal: true
});

function say(msg) {
  console.log("\r" + msg);
  rl.prompt();
}

ssdp.on('response', function (headers, statusCode, rinfo) {
  if (statusCode !== 200) { return; }
  const ident = [rinfo.address, rinfo.port].join(':');
  say(`Found new peer @ ${ident}`);
  renderers[ident] = new MediaRendererClient(headers.LOCATION);
});

rl.on('SIGINT', (input) => {
  quit();
});

rl.prompt();
rl.on('line', (input) => {
  procesLine(input);
  rl.prompt();
});

search();

function search() {
  say('Searching media renderers...');
  ssdp.search('urn:schemas-upnp-org:device:MediaRenderer:1');
}

async function renderer(host) {
  const renderer = renderers[host];
  if (!renderer) { throw({ type: 'not_found', host }); }
  return renderer;
}

async function play(host, ip) {
  const options = {
    autoplay: true,
    contentType: 'video/mp4',
    metadata: {
      title: 'Screen',
      type: 'video'
    }
  };

  const client = await renderer(host);

  const mediaURL = 'http://' + ip + ':8080/';
  console.log(`Streaming desktop from ${mediaURL}`)
  client.load(mediaURL, options, (err) => {
    if (err) {
      say(`An error occurred while playing: ${err}`);
      return;
    }
    say(`playing on ${host} ...`);
  });
}

async function stop(host) {
  const client = await renderer(host)
  client.stop();
}

async function pause(host) {
  const client = await renderer(host)
  client.pause();
}

async function resume() {
  const client = await renderer(host)
  client.resume();
}

function list() {
  say(Object.keys(renderers).join("\n"));
}

function help() {
  say(COMMAND_NAMES.join("\n"));
}

function quit() {
  recording.kill('SIGINT')
  console.log('Thank you, come again!');
  process.exit();
}

function procesLine(input) {
  const [cmd, ...args] = input.split(/\s+/);
  if (cmd == '') { return; }
  const dispatch = COMMAND_DISPATCH[cmd];
  if (!dispatch) { help(); return; }
  dispatch(...args);
}
