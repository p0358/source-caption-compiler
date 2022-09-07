import { SmartBuffer } from "smart-buffer";
import * as VDF from "vdf-parser";
import * as CRC32 from "crc-32";

interface SubtitleSourceFormat {
    lang: {
        Language: string;
        Tokens: {[token: string]: string};
    };
}

/**
 * Compile Source Engine captions file
 * @param vdf_text Input text to compile. Must be decoded from UTF-16 before passing.
 * @returns Compiled data
 */
export function compile(vdf_text: string): Buffer {
    const BLOCK_SIZE = 8192;
    const HEADER_SIZE = 24;
    const DIRECTORY_ENTRY_SIZE = 4+4+2+2; // crc + block index + offset + length
    const data: SubtitleSourceFormat = VDF.parse(vdf_text) as SubtitleSourceFormat;
    const buf = new SmartBuffer();
    const data_buf = new SmartBuffer(); // write raw data here before appending to the main buffer for simplicity
    // we divide data into `numblocks` blocks of `blocksize` size each
    // when the next string doesn't fit into the current block,
    // finalize the current one, write to main buffer, and begin writing new one
    let block = SmartBuffer.fromSize(BLOCK_SIZE);

    let entries = Object.entries(data.lang.Tokens);
    // order by token alphabetically
    entries = entries.sort((_a, _b) => {
        // note: must not use String.prototype.localeCompare, it yields different results
        const a = _a[0].toLocaleLowerCase(), b = _b[0].toLocaleLowerCase();
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
    });

    // header
    buf.writeString('VCCD', 'ascii'); // magic

    // version
    buf.writeInt32LE(1);

    // numblocks
    const numBlocksPos = buf.writeOffset;
    buf.writeInt32LE(0); // write later

    // blocksize
    buf.writeInt32LE(BLOCK_SIZE);

    // directorysize = number of entries in the directory (to get size in bytes multiply with directory entry size)
    buf.writeInt32LE(entries.length);

    const DICT_PADDING = 512 - (HEADER_SIZE + entries.length * DIRECTORY_ENTRY_SIZE) % 512;

    // dataoffset = where raw data starts (after header and all directory entries)
    buf.writeInt32LE(HEADER_SIZE + entries.length * DIRECTORY_ENTRY_SIZE + DICT_PADDING);

    const directoryOffset = buf.writeOffset; // directory entries begin here
    const dataOffset = buf.writeOffset + entries.length * DIRECTORY_ENTRY_SIZE + DICT_PADDING; // raw data begins here

    if (directoryOffset !== HEADER_SIZE)
        throw new Error("Invalid header size");

    let blockNum = 0;
    for (const [token, str] of entries) {
        const len = str.length * 2 + 2; // utf16 + null terminator
        if (block.writeOffset + len >= BLOCK_SIZE) {
            // new block time
            // write old block
            {
                // pad with zeros up to BLOCK_SIZE
                const blockDataSize = block.writeOffset;
                const paddingLength = BLOCK_SIZE - blockDataSize;
                block.writeBuffer(Buffer.alloc(paddingLength, 0)); // pad with zeroes up to BLOCK_SIZE
                // append to data buffer
                const oldOffset = data_buf.writeOffset;
                data_buf.writeBuffer(block.toBuffer());
                //console.log({blockDataSize, paddingLength, oldOffset, newOffset: data_buf.writeOffset, diff: data_buf.writeOffset - oldOffset})
                if (data_buf.writeOffset !== oldOffset + BLOCK_SIZE)
                    throw new Error("Invalid size when appending current block to data");
            }
            // create a new block
            {
                block = SmartBuffer.fromSize(BLOCK_SIZE);
                blockNum++;
            }
        }
        // add to buffer
        const oldOffset = block.writeOffset;
        block.writeString(str, "utf16le");
        block.writeInt16LE(0); // null terminator
        const written = block.writeOffset - oldOffset;
        if (written !== len)
            throw new Error("Written string length is different from the string length predicted earlier on...");
        // add new dictionary entry
        const crc = CRC32.bstr(token.toLocaleLowerCase()) >>> 0;
        buf.writeUInt32LE(crc);
        buf.writeUInt32LE(blockNum);
        buf.writeUInt16LE(oldOffset);
        buf.writeUInt16LE(written);
    }

    // append the last block to data
    if (block.writeOffset > 0) {
        // pad with zeros up to BLOCK_SIZE
        const blockDataSize = block.writeOffset;
        const paddingLength = BLOCK_SIZE - blockDataSize;
        block.writeBuffer(Buffer.alloc(paddingLength, 0)); // pad with zeroes up to BLOCK_SIZE
        // append to data buffer
        const oldOffset = data_buf.writeOffset;
        data_buf.writeBuffer(block.toBuffer());
        if (data_buf.writeOffset !== oldOffset + BLOCK_SIZE)
            throw new Error("Invalid size when appending last block to data");
    }

    buf.writeBuffer(Buffer.alloc(DICT_PADDING, 0)); // dictionary padding

    if (buf.writeOffset !== dataOffset)
        throw new Error("Ended up with invalid dictionary size");

    // append data buffer to main file buffer
    buf.writeBuffer(data_buf.toBuffer());

    const expectedSize = HEADER_SIZE + DIRECTORY_ENTRY_SIZE * entries.length + DICT_PADDING + BLOCK_SIZE * (blockNum+1);
    if (buf.writeOffset !== expectedSize)
        throw new Error("Final size differs from expected size");

    buf.writeInt32LE(blockNum+1, numBlocksPos);

    return buf.toBuffer();
}
