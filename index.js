#!/usr/bin/env node
const fs = require('fs')
const vm = require('vm')
const path = require('path')
const net = require('net')
const socks = require('socks').SocksClient
const program = require('commander')

program
  .option('--pac <file>', 'proxy.pac file location', path.resolve(__dirname, 'pac.js'))
  .option('--port <port>', 'proxy server\'s port', '8088')
  .parse(process.argv)
// 读取pac文件
if (program.pac[0] === '~') {
  program.pac = program.pac.replace(/^~/, require('os').homedir())
}
const pacScript = fs.readFileSync(path.resolve(process.cwd(), program.pac), { encoding: 'utf8' })
// 创建一个执行pac的沙盒
const sandbox = {}
vm.createContext(sandbox)
vm.runInContext(pacScript, sandbox)
// 监听请求
net.createServer(function (clientSocket){
  clientSocket.once('data', function (firstChunk){
    clientSocket.pause()
    // 获取host
    const chunkHost = firstChunk.toString().match(/Host: (.*)\r?\n/i)[1]
    // 查询匹配的代理
    vm.runInContext(`proxyUrl = FindProxyForURL('${chunkHost}', '${chunkHost}')`, sandbox)
    console.log(`the request host: ${chunkHost} will go through pac strategy: ${sandbox.proxyUrl}`)
    let proxySocket
    let port = +(chunkHost.split(':')[1] || '80')
    let host = chunkHost.split(':')[0]
    // 获取pac代理字符串第一个代理(不支持链式)
    // 如果使用socks代理
    if (sandbox.proxyUrl.match(/^SOCKS/i)) {
      const match = sandbox.proxyUrl.match(/^SOCKS(\d?)\s*(.*?):(\d*)/i)
      const opts = {
        proxy: {
          host: match[2], 
          port: +match[3],
          type: +(match[1] || 4) // Proxy version (4 or 5)
        },
        command: 'connect', // SOCKS command (createConnection factory function only supports the connect command)
        destination: {
          host,
          port
        }
      }
      socks.createConnection(opts, (err, info) => {
        if (err) {
          console.error(err)
        } else {
          proxySocket = info.socket
          proxySocket.write(firstChunk)
          clientSocket.pipe(proxySocket)
          clientSocket.resume()
          proxySocket.pipe(clientSocket)
        }
      })
    } else if (sandbox.proxyUrl.match(/^(PROXY|DIRECT)/i)) { // 直连或者普通代理(http)
      const match = sandbox.proxyUrl.match(/^PROXY\s*(.*?):(\d*)/i)
      if (match) {
        port = match[2]
        host = match[1]
      }
      proxySocket = net.createConnection(port, host, () => {
        proxySocket.write(firstChunk)
        clientSocket.pipe(proxySocket)
        clientSocket.resume()
        proxySocket.pipe(clientSocket)
      })
    } else {
      console.error('the pac file gives an unsupported strategy', sandbox.proxyUrl)
    }
    if (proxySocket) {
      proxySocket.on('error', err => {
        console.error(err)
        proxySocket.end()
        clientSocket.end(err.message)
      })
    }
  })
  clientSocket.on('error', err => {
    console.error(err)
    clientSocket.end(err.message)
  })
}).listen(program.port)