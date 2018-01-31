#!/usr/bin/env node

// TODO: make this better! if you're reading this,
// you should improve the wallet and send a pull request!

let { createHash, randomBytes } = require('crypto')
let fs = require('fs')
let Wallet = require('../client/wallet-methods.js')
let { connect } = require('lotion')
let mkdirp = require('mkdirp').sync
let { dirname, join } = require('path')
let genesis = require('../genesis.json')
let config = require('../config.js')

const HOME = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE
const keyPath = join(HOME, '.tiberium/keys.json')

console.log(`Usage:

balance
	    Gets your wallet balance and address

send <address> <amount>
	    Sends coins from your wallet to the given address

all
	    Show all current balances on the network
	    `)

async function main() {
  let privkey

  try {
    // load existing key
    let privkeyContents = fs.readFileSync(keyPath, 'utf8')
    let privkeyHex = JSON.parse(privkeyContents)[0].private
    privkey = Buffer.from(privkeyHex, 'hex')

  } catch (err) {
    if (err.code !== 'ENOENT') throw err

    // no key, generate one
    let keys = [ { private: randomBytes(32).toString('hex') } ]
    let keysJson = JSON.stringify(keys, null, '  ')
    mkdirp(dirname(keyPath))
    fs.writeFileSync(keyPath, keysJson, 'utf8')
    privkey = Buffer.from(keys[0].private, 'hex')

    console.log(`Generated private key, saving to "${keyPath}"`)
  }

  let timeout = setTimeout(() => console.log('Connecting...'), 2000)

  let nodes = config.peers.map((addr) => `ws://${addr}:46657`)

  let client = await connect(null, { genesis, nodes })
  let wallet = Wallet(privkey, client)

  // don't print "Connecting..." if we connect in less than 2s
  clearTimeout(timeout)

  var stdin = process.openStdin();

  stdin.addListener("data", async function(d) {
    var val = d.toString().trim();
    var cmd = val.split(" ");
      // send
    if (cmd.length === 3 && cmd[0] === 'send') {
      let recipientAddress = cmd[1]
      let amountToSend = Number(cmd[2]) * 1e8

      let res = await wallet
        .send(recipientAddress, amountToSend)
      console.log('done', res)
    }

    // get balance
    if (cmd.length === 1 && cmd[0] === 'balance') {
      let balance
      try {
        balance = await wallet.getBalance()
      } catch (err) {
        if (err.message === 'invalid state from full node') {
          // retry if we get this error
          balance = await wallet.getBalance()
        } else {
          throw err
        }
      }
      console.log('Address: ' + wallet.address)
      console.log(`Balance: ${balance / 1e8} TIB`)
    }

      if (cmd[0] == "all") {
	  var accounts = (await client.getState()).accounts;
	  Object.keys(accounts).forEach(function(address) {
	      console.log(address + ": " + (accounts[address].balance / 1e8) + " TIB")
	  });
      }
  });
}

main().catch((err) => console.error(err.stack))
