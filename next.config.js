/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Se mantiene: actions.ts (processDocs, chat, resetChatEngine) sigue
    // usando 'use server', asi quue este flag tiene que seguir prendido.
    serverActions: true,
  },
  // Se quitó `output: 'export'`.
  // Ese modo genera un sitio  estático (sin servidor Node corriendo),
  // yy tamto las Serverr Actions como nuestras API Routes nuevas (/api/pacientes/...)
  // necesitan un seervidor (`next dev` / `next start`) para ejecutarse.
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "sharp$": false,
      "onnxruntime-node$": false,
    }
    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
      asyncWebAssembly: true,
    };
    config.module.rules.push({
      test: /\.md$/i,
      use: "raw-loader",
    });
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        "node:fs/promises": false,
        assert: false,
        module: false,
        perf_hooks: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig