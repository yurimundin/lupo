/// <reference types="vite/client" />

// @fontsource-variable/* não publica tipos JS (apenas CSS + arquivos
// de fonte). TS 6 passou a exigir type declarations para side-effect
// imports (TS2882). Ambient declaration silencia o erro mantendo o
// import como contrato de carregamento de assets para o Vite resolver.
declare module "@fontsource-variable/geologica";
