import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

export default [
  { ignores: [".next/**", "node_modules/**", "public/data/**", "playwright-report/**"] },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // Inicializaciones legítimas tras montar (objetivo desde la URL,
      // disponibilidad de WebGL): patrón aceptado, se degrada a aviso.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];
