const HDWalletProvider = require('@truffle/hdwallet-provider');

require('dotenv').config();

const {
  MNEMONIC, 
  INFURA_ID_PROJECT, 
  ETHERSCAN_API_KEY, 
  ETH_MAINNET_GASPRICE, 
  DEFAULT_OPERATIONS_GASLIMIT, 
  TESTNETS_GASPRICE, 
  BSC_MAINNET_GASPRICE,
  BSCSCAN_API_KEY
} = process.env;

const Web3 = require("web3");
const web3 = new Web3();

module.exports = {
  /**
   * Networks define how you connect to your ethereum client and let you set the
   * defaults web3 uses to send transactions. If you don't specify one truffle
   * will spin up a development blockchain for you on port 9545 when you
   * run `develop` or `test`. You can ask a truffle command to use a specific
   * network from the command line, e.g
   *
   * $ truffle test --network <network-name>
   */

   plugins: ['truffle-plugin-verify', 'truffle-contract-size', "solidity-coverage"],

  api_keys: {
      etherscan: ETHERSCAN_API_KEY,
      bscscan: BSCSCAN_API_KEY
  },

  networks: {
    mainnet: {
      provider: () => new HDWalletProvider(MNEMONIC, "https://mainnet.infura.io/v3/" + INFURA_ID_PROJECT),
      network_id: 1,
      //gasPrice: web3.utils.toWei(ETH_MAINNET_GASPRICE, 'gwei'),
      //gas: DEFAULT_OPERATIONS_GASLIMIT,
      skipDryRun: false
    },
    kovan: {
      provider: () => new HDWalletProvider(MNEMONIC, "https://kovan.infura.io/v3/" + INFURA_ID_PROJECT),
      network_id: 42,
      confirmations: 2,
      //gas: DEFAULT_OPERATIONS_GASLIMIT,
      //gasPrice: web3.utils.toWei(TESTNETS_GASPRICE, 'gwei'),
      skipDryRun: true
    },
    bscTestnet: {
        provider: () => new HDWalletProvider(MNEMONIC, "https://data-seed-prebsc-1-s1.binance.org:8545"),
        network_id: 97,
        confirmations: 2,
        timeoutBlocks: 200,
        //gasPrice: web3.utils.toWei(TESTNETS_GASPRICE, 'gwei'),
        //gas: DEFAULT_OPERATIONS_GASLIMIT,
        skipDryRun: true
    },
    bscMainnet: {
        provider: () => new HDWalletProvider(MNEMONIC, "https://bsc-dataseed3.binance.org"),
        network_id: 56,
        confirmations: 2,
        timeoutBlocks: 200,
        //gasPrice: web3.utils.toWei(BSC_MAINNET_GASPRICE, 'gwei'),
        //gas: DEFAULT_OPERATIONS_GASLIMIT,
        skipDryRun: true
    }
  },

  // Set default mocha options here, use special reporters etc.
  /* mocha: {
    // timeout: 100000
  }, */

  // Configure your compilers
  compilers: {
    solc: {
        version: "0.8.9",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    }
  }
}
