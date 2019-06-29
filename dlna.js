const http = require('http');
const os = require('os');
const fs = require('fs');

const MediaRendererClient = require('upnp-mediarenderer-client');
const SSDPClient = require('node-ssdp').Client;
const renderers = {};
let ssdp;

function start(file, onPeer) {
  const proxy = http.createServer((req, res) => {
    const readStream = fs.createReadStream(file);

    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Transfer-Encoding': 'chunked'
    });

    readStream.pipe(res);
  });

  // Yolo, y'all can access my desktop
  proxy.listen(8080, '0.0.0.0');

  const interfaces = Object.entries(os.networkInterfaces())
    .filter(([name, info]) => info.some((address) => !address.internal))
    .map(([name, _]) => name);

  ssdp = new SSDPClient({
    interfaces,
    explicitSocketBind: true
  });

  ssdp.on('response', function (headers, statusCode, rinfo) {
    if (statusCode !== 200) { return; }
    const ident = [rinfo.address, rinfo.port].join(':');
    renderers[ident] = new MediaRendererClient(headers.LOCATION);
    onPeer(ident);
  });
}

function search() {
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

  return new Promise((resolve, reject) => {
    client.load(mediaURL, options, (error) => {
      if (error) { reject(error); return; }
      resolve();
    });
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
  return Object.keys(renderers);
}

module.exports = {
  start,
  search,
  renderer,
  play,
  stop,
  pause,
  resume,
  list
};
