# source-caption-compiler

A library to compile Source Engine's closed captions from human-readable text source file into the binary format read by the engine. You can use it as an alternative to the usage of Source SDK's built-in caption compiler if it fits your workflow better.

It does not support parsing the binary files back into the textual format (such operation would probably require supplying an array of valid source translation keys, as they're lost in the binary format and converted into CRC-32 checksums of those).

## Installation

```
npm install source-caption-compiler
```

## Usage

```ts
import * as fs from "node:fs";
import * as SourceCaptionCompiler from "source-caption-compiler";

const vdf_text = (await fs.promises.readFile("subtitles_english.txt", "utf16le")).toString();
const compiled = SourceCaptionCompiler.compile(vdf_text);
await fs.promises.writeFile("subtitles_english.dat", compiled);
```

`compiled` is a `Buffer` with raw compiled data.

## Example files

Example source:
```vdf
"lang"
{
	"Language" "english"
	"Tokens"
	{
		// Captions defined here.
		"DIAG_TEXT_01" "<clr:255,125,240>A test caption!"
		"DIAG_TEXT_02" "<clr:55,250,240>Another test caption!"
	}
}
```

Example compiled data:
```
00000000: 5643 4344 0100 0000 0100 0000 0020 0000  VCCD......... ..
00000010: 0200 0000 0002 0000 bcf2 a075 0000 0000  ...........u....
00000020: 0000 4200 06a3 a9ec 0000 0000 4200 4c00  ..B.........B.L.
00000030: 0000 0000 0000 0000 0000 0000 0000 0000  ................
< ... truncated ... >
000001f0: 0000 0000 0000 0000 0000 0000 0000 0000  ................
00000200: 3c00 6300 6c00 7200 3a00 3200 3500 3500  <.c.l.r.:.2.5.5.
00000210: 2c00 3100 3200 3500 2c00 3200 3400 3000  ,.1.2.5.,.2.4.0.
00000220: 3e00 4100 2000 7400 6500 7300 7400 2000  >.A. .t.e.s.t. .
00000230: 6300 6100 7000 7400 6900 6f00 6e00 2100  c.a.p.t.i.o.n.!.
00000240: 0000 3c00 6300 6c00 7200 3a00 3500 3500  ..<.c.l.r.:.5.5.
00000250: 2c00 3200 3500 3000 2c00 3200 3400 3000  ,.2.5.0.,.2.4.0.
00000260: 3e00 4100 6e00 6f00 7400 6800 6500 7200  >.A.n.o.t.h.e.r.
00000270: 2000 7400 6500 7300 7400 2000 6300 6100   .t.e.s.t. .c.a.
00000280: 7000 7400 6900 6f00 6e00 2100 0000 0000  p.t.i.o.n.!.....
00000290: 0000 0000 0000 0000 0000 0000 0000 0000  ................
< ... truncated ... >
000021f0: 0000 0000 0000 0000 0000 0000 0000 0000  ................
```

More info on Source's closed captions: https://developer.valvesoftware.com/wiki/Closed_Captions
