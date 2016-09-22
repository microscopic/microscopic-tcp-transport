'use strict'

const chai = require('chai')
const Mitm = require('mitm')
const JSONStream = require('JSONStream')

const expect = chai.expect

const TCPTransport = require('../lib/index')

describe('TCP Transport', () => {
  describe('listen()', () => {
    it('should throw error if service does not have `onMessage` method', () => {
      expect(() => new TCPTransport().listen({})).to.throw()
    })

    it('should return promise', () => {
      expect(new TCPTransport().listen({ onMessage: () => 1 })).to.be.instanceOf(Promise)
    })

    it('should return connection config', (done) => {
      new TCPTransport().listen({ onMessage: () => 1 })
        .then((connectionConfig) => {
          expect(connectionConfig).to.have.all.keys([ 'address', 'port' ])

          done()
        })
    })
  })

  describe('send()', () => {
    let mitm

    beforeEach(() => { mitm = Mitm() })
    afterEach(() => mitm.disable())

    it('should create new connection', (done) => {
      mitm.on('connect', (socket, opts) => {
        expect(opts).to.be.deep.equal({ host: '127.0.0.1', port: 1234 })
        done()
      })

      const client = new TCPTransport()

      client.send({ address: '127.0.0.1', port: 1234 }, { a: 1 }, (error, response) => {
      })
    })

    it('should send JSON', (done) => {
      mitm.on('connection', (socket) => {
        const reader = JSONStream.parse('*')

        reader.on('data', (message) => {
          expect(message).to.be.a('object')

          done()
        })

        socket.pipe(reader)
      })

      const client = new TCPTransport()

      client.send({ address: '127.0.0.1', port: 1234 }, { a: 1 }, () => {
      })
    })

    it('should not create second connection', (done) => {
      const connects = []

      mitm.on('connect', (socket, opts) => {
        connects.push(opts)
      })

      mitm.on('connection', (socket) => {
        const reader = JSONStream.parse('*')
        const writer = JSONStream.stringify()

        reader.on('data', (message) => {
          writer.write({ id: message.id, result: '' })
        })

        socket.pipe(reader)
        writer.pipe(socket)
      })

      const client = new TCPTransport()

      client.send({ address: '127.0.0.1', port: 1234 }, { a: 1 }, () => {
        client.send({ address: '127.0.0.1', port: 1234 }, { a: 1 }, () => {
          expect(connects.length).to.be.equal(1)
          done()
        })
      })
    })
  })

  describe('communication', () => {
    it('client should be able to communication with server ', (done) => {
      const service = {
        onMessage: (message, reply) => {
          expect(message.a).to.be.equal(1)

          reply(null, { result: 'ok' })
        }
      }

      const client = new TCPTransport()

      new TCPTransport().listen(service)
        .then((connectionConfig) => {
          client.send(connectionConfig, { a: 1 }, (error, response) => {
            expect(response.result).to.be.equal('ok')

            done()
          })
        })
    })
  })
})
