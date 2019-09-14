const chalk = require('chalk')

const logLevels = {
  'debug': chalk.white,
  'info': chalk.green,
  'warn': chalk.yellow,
  'error': chalk.red
}

const createLogger = (verbose = false) => {
  const logger = Object.create(null)
  Object.keys(logLevels).forEach(level => {
    if (level === 'debug' && !verbose) {
      logger[level] = () => {}
      return
    }
    const color = logLevels[level]
    logger[level] = (...args) => {
      console.log(color(`[${level}]pac-proxy-server`), ...args)
    }
  })
  return logger
}

module.exports = createLogger
