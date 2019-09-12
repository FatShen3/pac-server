# pac-proxy-server

## Installation

```bash
npm i -g pac-proxy-server
```

## before use

* You should have the `proxy.pac` file, and the proxy address in it is correct.
* 

## how to use

By passing the `proxy.pac` file location, this module will use the `FindProxyForURL` function to figure out which proxy to use, and then send the request through the proxy.

```bash
pps --pac ~/.ShadowsocksX-NG/gfwlist.js --port 8088
```

By default, this module will use socks5 proxy `127.0.0.1:1080` for [gfwlist](https://github.com/gfwlist/gfwlist) websites. Take a look at `./pac.js`.

## options

```bash
pps --help

Usage: pps [options]

Options:
  --pac <file>   proxy.pac file location (default: "/your/npm/repo/pac-proxy-server/pac.js")
  --port <port>  proxy server's port (default: "8088")

```

## unsupported

* proxy chains (chains like `SOCKS5 127.0.0.1:1080; SOCKS 127.0.0.1:1080; DIRECT;`, at this time we will only use the first one: `SOCKS5 127.0.0.1:1080)`