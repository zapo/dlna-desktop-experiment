const readline = require('readline');
const recorder = require('./recorder');
const dlna = require('./dlna');

const COMMANDS = {
  HELP: { name: 'help', call: help },
  LIST: {
    name: 'list',
    call: () => say(dlna.list().join("\n"))
  },
  PAUSE: {
    name: 'pause',
    call: dlna.pause
  },
  PLAY: {
    name: 'play',
    call: (host, ip) => {
      dlna.play(host, ip).then(() => {
        say(`Starting to play on ${host}`)
      })
    }
  },
  STOP: {
    name: 'stop',
    call: dlna.stop
  },
  QUIT: {
    name: 'quit',
    call: () => {
      recorder.stop()
      console.log('Thank you, come again!');
      process.exit();
    }
  },
  RESUME: {
    name: 'resume',
    call: dlna.resume
  },
  SEARCH: {
    name: 'search',
    call: dlna.search
  },
};

const COMMAND_NAMES = Object.values(COMMANDS).map((c) => c.name);
const COMMAND_DISPATCH = Object.values(COMMANDS).reduce((memo, cmd) => {
  memo[cmd.name] = cmd.call;
  return memo;
}, {});

let rl;

function procesLine(input) {
  const [cmd, ...args] = input.split(/\s+/);
  if (cmd == '') { return; }
  const dispatch = COMMAND_DISPATCH[cmd];
  if (!dispatch) { help(); return; }
  dispatch(...args);
}

function say(msg) {
  console.log("\r" + msg);
  rl.prompt();
}

function help() {
  say(COMMAND_NAMES.join("\n"));
}

function quit() {
  recorder.stop()
  console.log('Thank you, come again!');
  process.exit();
}

function start() {
  rl = readline.createInterface({
    prompt: '> ',
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });

  rl.on('SIGINT', (input) => {
    COMMANDS.QUIT.call();
  });

  rl.prompt();
  rl.on('line', (input) => {
    procesLine(input);
    rl.prompt();
  });

  const path = recorder.start();

  dlna.start(path, (peer) => {
    say(`Found new peer @ ${peer}`)
  });

  dlna.search();
}

module.exports = { start };
