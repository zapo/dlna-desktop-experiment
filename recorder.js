const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');

// FIXME: Use properly generated tempfiles
const TMP = '/tmp/video.flv';

const FFMPEG_ARGS = [
  '-y',
  '-f', 'x11grab',
  '-show_region', '1',
  '-s', '1920x1080',
  '-r', '60',
  '-i', ':0.0+0,0',
  '-vcodec', 'libx264',
  '-pix_fmt', 'yuv420p',
  '-preset', 'ultrafast',
  '-tune', 'zerolatency',
  '-f', 'flv',
  TMP
];

let recording;

function start() {
  recording = execFile('ffmpeg', FFMPEG_ARGS);
  return TMP;
}

function stop() {
  if (!recording) { return; }
  recording.kill('SIGINT');
}

module.exports = { start, stop };
