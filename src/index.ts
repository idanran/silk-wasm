import silkWasm from './silk_wasm.js'

export async function encode(input: Buffer, sampleRate: number): Promise<Buffer> {
    const instance = await silkWasm()
    const u8Array = Uint8Array.from(input)

    const arr: Buffer[] = []

    const ret = instance.silk_encode(u8Array, input.length, sampleRate, (chunk: Uint8Array) => {
        const buf = Buffer.from(chunk)
        arr.push(buf)
    })

    if (ret === 0) throw new Error('编码失败')

    return Buffer.concat(arr).subarray(0, -1)
}

export function getDuration(silk: Buffer, frameMs = 20): number {
    let tencent = false
    if (silk[0] === 0x02) {
        tencent = true
    }
    let offset = tencent ? 10 : 9
    let i = 0
    while (offset < silk.length) {
        const size = silk.readUInt16LE(offset)
        offset += 2
        i += 1
        offset += size
    }
    return i * frameMs
}