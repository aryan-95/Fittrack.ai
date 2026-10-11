/** Palette: iron (ink), chalk (page), plate (primary teal), signal (progress amber), lift (danger). */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { iron: "#17212B", chalk: "#EEF1EE", plate: { DEFAULT: "#0E7C7B", dark: "#0A5E5D", light: "#D5ECEB" }, signal: "#F2A900", lift: "#C8442F", mute: "#5B6772", line: "#D4DAD6" },
      fontFamily: { display: ['"Archivo"', "system-ui", "sans-serif"], body: ['"Source Sans 3"', "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
