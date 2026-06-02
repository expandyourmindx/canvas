# Canvas DAW — Atari Paper Theme · Agent Context
Paste this at the start of any coding session involving the Atari Paper theme.

---

You are working on **Canvas DAW** using the **Atari Paper theme**.
Reference: Steinberg Cubase on Atari ST, 1989. Ink on paper. Monochrome.

## The One Rule
This is a two-color system. Black ink on warm paper.
The ONLY accent colors are `selection` (#0000b8) and `playhead` (#b80000).
Nothing else gets color. Not channels. Not hover states. Not VU bars. Nothing.

## NEVER
- `border-radius` on anything except circular knobs
- `box-shadow` except `'2px 2px 0 #0d0d0d'` on floating panels only
- `transition` or `animation` of any kind
- `gradient` of any kind
- Any color other than the two accents
- Cool gray surfaces — paper is warm (#f0ede4, not #f0f0f0)
- Invisible VU off-segments — they must show as `#ccc9c0`
- Courier New for labels — Geneva for labels, Courier for values only

## ALWAYS
- `gemRaised()` for raised surfaces: paper top/left, ink bottom/right
- `gemSunken()` for sunken surfaces: ink top/left, paper bottom/right  
- `inkBorder()` for hard borders: 1px solid #0d0d0d
- Active button = bevel inverts + selection blue fill + paper text
- VU off-segments visible as paperPanel (#ccc9c0)
- EQ curves as SVG `<polyline>` not smooth bezier paths
- Drop shadow = `boxShadow: '2px 2px 0 #0d0d0d'` only

## Surface Scale
```
paper       #f0ede4   main background
paperDark   #e4e1d8   sunken panels
paperDeep   #d8d5cc   toolbar / button fill
paperPanel  #ccc9c0   deepest / VU off
```

## Ink Scale
```
ink         #0d0d0d   primary
inkMid      #484844   secondary
inkLight    #888880   tertiary
inkGhost    #c0bdb4   grid / ghost
```

## Full Spec
See `ATARI_PAPER_SPEC.md` and `atari-paper-tokens.js`.
