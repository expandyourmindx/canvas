export const LOCAL_EFFECTS = [
  {
    id: "burns-distortion",
    name: "Simple Distortion",
    url: "https://plugins.canvasdaw.com/burns-audio/distortion/index.js",
    description: "Waveshaper distortion",
  },
  {
    id: "canvas-limiter",
    name: "Canvas Limiter",
    url: "https://expandyourmindx.github.io/canvas-limiter/index.js",
    description: "Limiter and Compression",
  },
];

export const getAccentOptions = (DARK: any) => [
  { label: "BLUE",   value: DARK.accentBlue },
  { label: "GREEN",  value: DARK.accentGreen },
  { label: "PURPLE", value: DARK.accentPurple },
  { label: "ORANGE", value: DARK.accentOrange },
  { label: "MASTER", value: DARK.accentMaster },
];

