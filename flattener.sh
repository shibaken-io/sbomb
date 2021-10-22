#!/bin/bash

rm -rf ./node_modules/truffle-flattener
npx github:fedeb95/truffle-flattener $1 > ./flattened1.sol
(sed '3!{/\/\/ SPDX.*/d;}' flattened1.sol) > ./contracts/flattened.sol
rm ./flattened1.sol