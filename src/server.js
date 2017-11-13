const express = require('express')
const startIpfsAndOrbitDB = require('./start-ipfs-and-orbitdb')

const create = require('./routes/create')
const get = require('./routes/get')

const Logger = require('logplease')
const logger = Logger.create("orbit-db-http-server", { color: Logger.Colors.Yellow })
Logger.setLogLevel('ERROR')

const defaultPort = require('../src/default-port')

const startHttpServer = async (options = {}) => {
  // Make sure we have a port
  const port = options.port || defaultPort
  logger.log(`Start http-server in port ${port}`)

  // Create the server
  const app = express()

  return new Promise((resolve, reject) => {
    // Start the HTTP server
    let server = app.listen(port, async () => {
      // Start IPFS and OrbitDB
      let { orbitdb, ipfs } = await startIpfsAndOrbitDB(options)
      // Add a state info object to the server
      server.state = {
        // Set the port the server was started
        port: port,
        // Set the state to started
        started: true,
      }
      // Add a stop function that resets the server state after the server was closed
      server.stop = () => {
        return new Promise(resolve => {
          server.close(async () => {
            await orbitdb.disconnect()
            await ipfs.stop()
            delete server.state
            resolve()
          })
        })
      }

      const logRequest = (req, res, next) => {
        logger.debug(`[${req.method}] ${req.url}`)
        next()
      }

      const useOrbitDB = (req, res, next) => {
        req.orbitdb = orbitdb
        next()
      }

      // Setup routes
      app.use(logRequest) // Logging
      app.use(useOrbitDB) // Pass OrbitDB instance to the route handlers
      app.get('/', (req, res) => res.send('OrbitDB')) // Default index page
      app.get('/orbitdb/*', get) // Query a database
      app.get('/create/:type/:name', create) // Create a new databse

      // Started
      const startedText = `OrbitDB server started at http://localhost:${port}/`
      logger.log(startedText)
      console.log(startedText)

      // Return the server
      resolve(server)
    })
  })
}

module.exports = startHttpServer