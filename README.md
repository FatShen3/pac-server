# pac-proxy-server

## Installation

```bash
npm i -g pac-proxy-server
```

## usage

During my work, I need to visit some websites via socks proxy, some internal network via my company's http proxy, and others direct. Through all the above can be done via [pac](https://en.wikipedia.org/wiki/Proxy_auto-config), but I still need pac strategy in command line, some paricular application, etc, which do not support pac directly.

## before use

* You should have the `proxy.pac` file, and the proxy address in it is usable

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
  --port <port>  proxy server's port (default: 8088)
  --timeout <timeout>  each proxy timeout (default: 10000)
```

## unsupported

* proxy chains