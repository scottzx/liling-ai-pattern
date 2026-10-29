# 醴陵釉下五彩 pattern library (demo)

5 themes × (4 compliant + 1 deliberately non-compliant) = 25 patterns. Main target: **胜利杯 (Victory cup)**.

## Palette — `palette.json`
"Demo palette, to be calibrated by factory" (approximate sRGB, not measured fired colours).
14 pigments: 玛瑙红 #B8323A, 桃红 #E07A8F, 芙蓉红 #E8A0A0, 海碧 #2F6FA8, 海蓝 #3D5A98, 草青 #4E8C4A, 浅绿 #9CC79A, 墨绿 #2E5A3A, 碧绿 #3E9A8A, 钛黄 #E8C84A, 橘黄 #E89A3A, 赭色 #8A5A3A, 紫 #7A5A9A, 艳黑 #2A2A2A. Outlines (分水 lines) #FFFFFF, ground porcelain white #FFFFFF.
`tint_levels`: each pigment comes in 4 tints toward white, factors 1.0 / 0.7 / 0.45 / 0.25 (pigment·f + white·(1−f)), giving 56 exact hex values listed per pigment.

**Compliance rule:** every pixel must be exactly one of the 56 tints or #FFFFFF. In other words, the hue must be a palette pigment. A lighter tint is watercolour density, not a violation.

## Pipeline (`process.py` helpers → `process2.py` → `snap.py`)
1. `raw/{theme}_{0-3}.jpg`: GenerateImage originals (16:9). Prompts are in `prompts.json` / `index.json`.
2. Pad to 2:1 with white so the motif's front centre is at the horizontal middle. Fade the left and right 3% to white so the edges tile seamlessly.
3. At 2048×1024 working size, assign each pixel to its nearest pigment in Lab and pick the nearest of that pigment's 4 tints. Near-white paper becomes white, and dark line art becomes white lines.
4. Mode filter, then draw 3px white 分水 lines on every boundary between different pigments. Upscale with NEAREST to **4096×2048**.
5. `snap.py`: snap every remaining non-exact colour to the nearest tint or white in Lab. It then counts off-palette colours, writes the crops and renders the previews.

## Outputs
- `final/{id}.png`: 4096×2048, exactly 2:1, horizontally seamless, front centre in the middle.
- `crop_cup/{id}_cup4096x1428.png`: a centred crop (rows 310–1738) for the cup's main band. The band is outer_06+07 treated as one cone (r 37.4→43.9 mm, slant 96.2 mm, ≈2.87:1).
- `preview/{id}_cupfan.png`: the cup crop polar-mapped onto the fan-shaped band of the cone.
- `index.json`: one entry per image with:
  - id, theme, prompt
  - compliant, violation_reason
  - file, crop_cup, preview
  - palette_colors_used, check.seam_ok
  - `offpalette_colors`: the number of distinct colours that are not an exact tint or white. It is 0 for every compliant image. `offpalette_colors_crop` gives the same count for the crop.
  - coverage, on bad images only

## Deliberate violations (`{theme}_bad`)
| id | violation | coverage |
|---|---|---|
| biandou_bad | reds, yellows and 海碧 replaced by bright off-palette purple #B000FF | 9.2% |
| mudan_bad | all peony petals in purple #B000FF | 13.2% |
| qinniao_bad | magpies and flowers in purple #B000FF | 4.1% |
| siji_bad | all leaves solid 艳黑 laid over 海碧 (overlap), with a 海碧 rim visible | 4.3% |
| shanshui_bad | the whole river solid 艳黑 over 海碧 | 7.3% |

## Browser quantizer — `quantize.js`
A dependency-free ES module that runs the per-pixel colour step of the Python pipeline in the browser. Each pixel goes to the nearest of the 56 tints or #FFFFFF in Lab; near-white pixels (L>90, chroma<10) become white. It uses a 64³ RGB lookup table (built once, about 0.1 s).
```js
import { quantize, stats, PALETTE, TINT_FACTORS } from './quantize.js';
const img = ctx.getImageData(0, 0, c.width, c.height);
ctx.putImageData(quantize(img /*, {lutBits:6, inPlace:false} */), 0, 0);
stats(img); // {玛瑙红: n, …, white: n, other: n}; other = off-palette pixels
```
It does not do padding, edge fade, line-art removal, mode filter, or the 分水 white lines. Those stay in process2.py. Pad and fade first if you need a seamless 2:1 result.
