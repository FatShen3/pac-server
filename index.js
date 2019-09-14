#!/usr/bin/env node
const fs = require('fs')
const vm = require('vm')
const path = require('path')
const net = require('net')
const socks = require('socks').SocksClient
const program = require('commander')
const { promisify } = require('util')
const readFile = promisify(fs.readFile)
const exec = require('child_process').exec

program
  .option('--pac <filepath>', 'proxy.pac file location', path.resolve(__dirname, 'pac.js'))
  .option('--port <port>', 'proxy server\'s port', '8088')
  .option('--timeout <timeout>', 'each proxy timeout', 10000)
  .option('--verbose', 'verbose mode', false)
  .parse(process.argv)

const to = p => p.then(data => [null, data]).catch(err => [err || new Error('unknown error')])

async function runserver () {
  // 获取pac文件路径
  const [execErr, execInfo] = await to(promisify(exec)(`echo ${program.pac}`, { cwd: process.cwd() }))
  if (execErr || execInfo.stderr) {
    console.error(`finding pac file path error: ${execErr || execInfo.stderr}`)
    process.exit(1)
  }
  const pacPath = execInfo.stdout.replace(/[\r\n]/g, '')
  console.log(`pac file location: ${pacPath}`)
  // 读取pac文件
  const [pacErr, pacScript] = await to(readFile(pacPath, { encoding: 'utf8' }))
  if (pacErr) {
    console.error(`reading pac file error: ${pacErr}`)
    process.exit(1)
  }
  // 创建一个执行pac的沙盒
  const sandbox = {}
  vm.createContext(sandbox)
  vm.runInContext(pacScript, sandbox)
  // 开启代理服务器
  net.createServer(clientSocket => {
    clientSocket.once('data', async firstChunk => {
      // clientSocket.pause()
      // 获取host
      const chunkHost = firstChunk.toString().match(/Host: (.*)\r?\n/i)[1]
      // 查询匹配的代理
      vm.runInContext(`proxyUrl = FindProxyForURL('${chunkHost}', '${chunkHost}')`, sandbox)
      console.log(`the request host: ${chunkHost}, will go through pac strategy: ${sandbox.proxyUrl}`)
      let port = +(chunkHost.split(':')[1] || '80')
      let host = chunkHost.split(':')[0]
      const proxyStrategies = []
      let socksChains
      for (let strategy of sandbox.proxyUrl.split(';')) {
        strategy = strategy.trim()
        if (strategy === '') {
          continue
        } else {
          proxyStrategies.push(strategy)
        }
      }
      for (let i = 0, len = proxyStrategies.length; i < len; i++) {
        const proxyStrategy = proxyStrategies[i]
        const [proxyErr] = await to(runpStrategy(proxyStrategy, host, port, firstChunk, clientSocket))
        if (proxyErr) {
          console.error(`proxy ${proxyStrategy} got error: `, proxyErr)
          if (i === len - 1) {
            clientSocket.end('all of the proxies failed :(\n')
            console.error('all of the proxies failed :(')
          }
        } else {
          break
        }
      }
    })
    clientSocket.on('error', err => {
      console.error(`client socket got error: ${err}`)
    })
  }).listen(program.port)
  console.log(`pac-proxy-server listen on ${program.port}...`)
}

async function runpStrategy (proxyStrategy, host, port, firstChunk, clientSocket) {
  let proxySocket
  let proxyEventResolve, proxyEventReject
  const proxyEventPromise = new Promise((resolve, reject) => {
    proxyEventResolve = resolve
    proxyEventReject = reject
  })
  // 如果使用socks代理
  if (proxyStrategy.match(/^SOCKS/i)) {
    const match = proxyStrategy.match(/^SOCKS(\d?)\s*(.*?):(\d*)/i)
    const proxy = {
      host: match[2],
      port: +match[3],
      type: +(match[1] || 4) // Socks proxy version (4 or 5)
    }
    const opts = {
      proxy,
      command: 'connect', // SOCKS command (createConnection factory function only supports the connect command)
      destination: {
        host,
        port
      },
      timeout: program.timeout
    }
    const [socksErr, socksInfo] = await to(promisify(socks.createConnection)(opts))
    if (socksErr) {
      return Promise.reject(`create socks proxy error: ${socksErr}`)
    }
    proxySocket = socksInfo.socket
  } else if (proxyStrategy.match(/^(PROXY|DIRECT)/i)) { // 直连或者普通代理(http etc.)
    const match = proxyStrategy.match(/^PROXY\s*(.*?):(\d*)/i)
    if (match) {
      port = match[2]
      host = match[1]
    }
    proxySocket = net.createConnection(port, host, () => {

    })
  } else {
    return Promise.reject(`the pac file gives an unsupported strategy: ${proxyStrategy}`)
  }
  if (proxySocket) {
    proxySocket.setTimeout(program.timeout)
    proxySocket.on('error', err => {
      proxyEventReject(`${err}`)
    })
    proxySocket.on('timeout', () => {
      proxyEventReject(`timeout`)
      proxySocket.end()
    })
    proxySocket.on('end', () => {
      proxyEventResolve()
    })
    proxySocket.write(firstChunk)
    clientSocket.pipe(proxySocket)
    proxySocket.pipe(clientSocket)
    const [proxyErr] = await to(proxyEventPromise)
    if (proxyErr) {
      return Promise.reject(proxyErr)
    }
  }
}

runserver()
