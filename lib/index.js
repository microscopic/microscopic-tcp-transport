'use strict'

const net = require('net')
const JSONStream = require('JSONStream')

const utils = require('microscopic-utils')
const Asserts = utils.asserts
const IP = utils.ip

const Transport = require('microscopic-transport')

const _connections = Symbol('connections')

class TCPTransport extends Transport {
  constructor (options) {
    super(options)

    this[ _connections ] = new Map()
  }

  /**
   * @inheritDoc
   */
  listen (service) {
    Asserts.assert(typeof service.onMessage === 'function', new TypeError('Does not have `onMessage` method'))

    return new Promise((resolve) => {
      this.server = net.createServer((connection) => {
        const reader = JSONStream.parse('*')
        const writer = JSONStream.stringify()

        reader.on('data', (message) => {
          const reply = (error, response) => writer.write({ id: message.id, result: response })

          service.onMessage(message, reply)
        })

        connection.pipe(reader)
        writer.pipe(connection)
      })

      this.server.listen(() => {
        resolve({ address: IP.getIP(), port: this.server.address().port })
      })
    })
  }

  /**
   * @inheritDoc
   */
  send (connectionConfig, msg, callback) {
    const message = super.createMessage(msg, callback)

    const connectionId = connectionConfig.address + connectionConfig.port

    let connection = this[ _connections ].get(connectionId)

    if (connection) {
      return connection.writer.write(message)
    }

    connection = net.connect(connectionConfig.port, connectionConfig.address)

    connection.reader = JSONStream.parse('*')
    connection.writer = JSONStream.stringify()

    connection.pipe(connection.reader)
    connection.writer.pipe(connection)

    connection.reader.on('data', super.onResponse.bind(this))

    connection.on('connect', () => {
      this[ _connections ].set(connectionId, connection)
      connection.writer.write(message)
    })
  }
}

module.exports = TCPTransport
