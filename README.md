Quick & dirty CLI script to stream desktop on UPNP/DLNA renderers.

Don't use this.

Dependencies:
- libx264
- ffmpeg
- node
- x11

Install:
```
npm install
```

Usage:
```
$ node index.js

> search
Found new peer @ HOST:PORT
> play HOST:PORT ACCESSIBLE_IP_FROM_HOST
> stop HOST:PORT
> quit
```
