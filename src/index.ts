import Instance from './silk_wasm.js'
import * as WavDecoder from 'wav-file-decoder'
import { concat, ensureMonoPcm, ensureS16lePcm } from './utils'

export interface encodeResult {
    /** silk */
    data: Uint8Array
    /** unit: milliseconds */
    duration: number
}

export interface decodeResult {
    /** pcm_s16le */
    data: Uint8Array
    /** unit: milliseconds */
    duration: number
}

export interface WavFileInfo {
    chunkInfo: {
        chunkId: string
        dataOffset: number
        dataLength: number
    }[]
    fmt: {
        formatCode: number
        numberOfChannels: number
        sampleRate: number
        bytesPerSec: number
        bytesPerFrame: number
        bitsPerSample: number
    }
}

export async function encode(input: ArrayBufferView | ArrayBuffer, sampleRate: number): Promise<encodeResult> {
    const instance = await Instance()
    let buffer = ArrayBuffer.isView(input) ? input.buffer : input

    if (WavDecoder.isWavFile(input)) {
        const { channelData, sampleRate: wavSampleRate } = WavDecoder.decodeWavFile(input)
        sampleRate ||= wavSampleRate
        buffer = ensureS16lePcm(ensureMonoPcm(channelData))
    }

    const arr: Uint8Array[] = []
    let outputLength = 0

    const ret = instance.silk_encode(buffer, buffer.byteLength, sampleRate, (chunk: Uint8Array) => {
        outputLength += chunk.length
        arr.push(chunk.slice())
    })

    if (ret === 0) throw new Error('silk encoding failure')
    const last = arr.pop()
    if (last) {
        arr.push(last.slice(0, -1))
        outputLength--
    }

    return {
        data: concat(arr, outputLength),
        duration: ret
    }
}

export async function decode(input: ArrayBufferView | ArrayBuffer, sampleRate: number): Promise<decodeResult> {
    const instance = await Instance()
    const buffer = ArrayBuffer.isView(input) ? input.buffer : input

    const arr: Uint8Array[] = []
    let outputLength = 0

    const ret = instance.silk_decode(buffer, buffer.byteLength, sampleRate, (chunk: Uint8Array) => {
        outputLength += chunk.length
        arr.push(chunk.slice())
    })

    if (ret === 0) throw new Error('silk decoding failure')

    return {
        data: concat(arr, outputLength),
        duration: ret
    }
}

export function getDuration(silk: ArrayBufferView | ArrayBuffer, frameMs = 20): number {
    const buffer = ArrayBuffer.isView(silk) ? silk.buffer : silk
    const tencent = silk[0] === 0x02
    let offset = tencent ? 10 : 9
    let blocks = 0
    const view = new DataView(buffer)
    while (offset < view.byteLength) {
        const size = view.getUint16(offset, true)
        blocks += 1
        offset += size + 2
    }
    return blocks * frameMs
}

export function isWav(fileData: ArrayBufferView | ArrayBuffer): boolean {
    return WavDecoder.isWavFile(fileData)
}

export function getWavFileInfo(fileData: ArrayBufferView | ArrayBuffer): WavFileInfo {
    return WavDecoder.getWavFileInfo(fileData)
}