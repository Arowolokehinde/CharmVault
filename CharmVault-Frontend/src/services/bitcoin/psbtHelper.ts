import * as bitcoin from 'bitcoinjs-lib'
import { Buffer } from 'buffer'

/**
 * Convert unsigned raw transaction hex to PSBT hex for signing
 *
 * @param unsignedTxHex - Raw transaction hex from Prover API (unsigned)
 * @param prevTxHex - Previous transaction hex (to extract output data)
 * @param inputIndex - Which output from prevTx is being spent (vout)
 * @param network - Bitcoin network (testnet or mainnet)
 * @returns PSBT hex string ready for wallet signing
 */
export function convertRawTxToPsbt(
  unsignedTxHex: string,
  prevTxHex: string,
  inputIndex: number,
  network: 'testnet' | 'mainnet' = 'testnet'
): string {
  // Select network
  const btcNetwork = network === 'testnet'
    ? bitcoin.networks.testnet
    : bitcoin.networks.bitcoin

  // Parse the unsigned transaction
  const unsignedTx = bitcoin.Transaction.fromHex(unsignedTxHex)

  // Parse the previous transaction to get the output being spent
  const prevTx = bitcoin.Transaction.fromHex(prevTxHex)
  const prevOut = prevTx.outs[inputIndex]

  if (!prevOut) {
    throw new Error(`Previous transaction output ${inputIndex} not found`)
  }

  // Create PSBT from the unsigned transaction
  const psbt = new bitcoin.Psbt({ network: btcNetwork })

  // Add each input with witness UTXO data
  for (let i = 0; i < unsignedTx.ins.length; i++) {
    const input = unsignedTx.ins[i]

    // Get the transaction hash being spent
    const prevTxId = Buffer.from(input.hash).reverse().toString('hex')
    const prevVout = input.index

    // For the funding UTXO, we have the prevTx data
    // For other inputs (in spell tx), we'd need their prevTx data too
    // For now, we'll add witness UTXO for the main input
    if (i === 0) {
      psbt.addInput({
        hash: prevTxId,
        index: prevVout,
        witnessUtxo: {
          script: prevOut.script,
          value: prevOut.value,
        },
        // For Taproot inputs, we might need tapInternalKey
        // But for now, let's try with just witnessUtxo
      })
    } else {
      // For other inputs, add minimal data
      // This might need to be enhanced based on the actual transaction structure
      psbt.addInput({
        hash: prevTxId,
        index: prevVout,
      })
    }
  }

  // Add outputs
  for (const output of unsignedTx.outs) {
    psbt.addOutput({
      script: output.script,
      value: output.value,
    })
  }

  // Return PSBT as hex string
  return psbt.toHex()
}

/**
 * Convert raw transaction to PSBT with multiple previous transactions
 * Used for spell transactions that may have multiple inputs
 */
export function convertRawTxToPsbtMultiple(
  unsignedTxHex: string,
  prevTxsData: Array<{ txHex: string; vout: number }>,
  network: 'testnet' | 'mainnet' = 'testnet'
): string {
  const btcNetwork = network === 'testnet'
    ? bitcoin.networks.testnet
    : bitcoin.networks.bitcoin

  const unsignedTx = bitcoin.Transaction.fromHex(unsignedTxHex)
  const psbt = new bitcoin.Psbt({ network: btcNetwork })

  // Add each input with its corresponding witness UTXO data
  for (let i = 0; i < unsignedTx.ins.length; i++) {
    const input = unsignedTx.ins[i]
    const prevTxId = Buffer.from(input.hash).reverse().toString('hex')
    const prevVout = input.index

    // Find the corresponding previous transaction
    const prevTxData = prevTxsData[i]
    if (!prevTxData) {
      throw new Error(`Previous transaction data for input ${i} not found`)
    }

    const prevTx = bitcoin.Transaction.fromHex(prevTxData.txHex)
    const prevOut = prevTx.outs[prevVout]

    if (!prevOut) {
      throw new Error(`Previous transaction output ${prevVout} not found for input ${i}`)
    }

    psbt.addInput({
      hash: prevTxId,
      index: prevVout,
      witnessUtxo: {
        script: prevOut.script,
        value: prevOut.value,
      },
    })
  }

  // Add outputs
  for (const output of unsignedTx.outs) {
    psbt.addOutput({
      script: output.script,
      value: output.value,
    })
  }

  return psbt.toHex()
}

/**
 * Extract final signed transaction hex from a signed PSBT
 *
 * @param signedPsbtHex - Signed PSBT hex from wallet
 * @param network - Bitcoin network
 * @returns Raw transaction hex ready for broadcast
 */
export function extractTxFromPsbt(
  signedPsbtHex: string,
  network: 'testnet' | 'mainnet' = 'testnet'
): string {
  const btcNetwork = network === 'testnet'
    ? bitcoin.networks.testnet
    : bitcoin.networks.bitcoin

  const psbt = bitcoin.Psbt.fromHex(signedPsbtHex, { network: btcNetwork })

  // Try to finalize all inputs
  // For Taproot inputs, we may need custom finalization
  try {
    psbt.finalizeAllInputs()
  } catch (error: any) {
    console.warn('Standard finalization failed, attempting manual Taproot finalization:', error.message)

    // For Taproot inputs, try to finalize manually
    for (let i = 0; i < psbt.data.inputs.length; i++) {
      try {
        // Check if already finalized
        if (psbt.data.inputs[i].finalScriptWitness || psbt.data.inputs[i].finalScriptSig) {
          console.log(`Input ${i} already finalized`)
          continue
        }

        // Try standard finalization first
        psbt.finalizeInput(i)
      } catch (finalizeError: any) {
        console.warn(`Could not finalize input ${i}:`, finalizeError.message)

        // For Taproot key-path spends, manually create the witness
        const input = psbt.data.inputs[i]
        if (input.tapKeySig) {
          // Taproot key-path spend: witness stack has just the signature
          // Witness format: <number of elements> <element 1 length> <element 1 data>
          const witnessStack = Buffer.concat([
            Buffer.from([0x01]), // 1 witness element
            Buffer.from([input.tapKeySig.length]), // signature length (usually 64 bytes)
            input.tapKeySig // the signature
          ])

          psbt.data.inputs[i].finalScriptWitness = witnessStack
          console.log(`Manually finalized Taproot input ${i} with key-path spend`)
        } else if (input.partialSig && input.partialSig.length > 0) {
          // Legacy SegWit signature
          const partialSig = input.partialSig[0]
          const witnessStack = Buffer.concat([
            Buffer.from([0x02]), // 2 witness elements
            Buffer.from([partialSig.signature.length]),
            partialSig.signature,
            Buffer.from([partialSig.pubkey.length]),
            partialSig.pubkey
          ])

          psbt.data.inputs[i].finalScriptWitness = witnessStack
          console.log(`Manually finalized SegWit input ${i}`)
        } else {
          throw new Error(`Unable to finalize input ${i}: no signature found`)
        }
      }
    }
  }

  // Extract the final transaction
  const finalTx = psbt.extractTransaction()

  // Return as hex
  return finalTx.toHex()
}
