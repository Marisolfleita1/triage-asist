/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // El cliente de Chroma se carga desde node_modules en vez de pasar por webpack
    serverComponentsExternalPackages: ["chromadb"],
  },
  // No se usa `output: 'export'`: ese modo genera un sitio estático y las API Routes
  // (/api/pacientes, /api/clasificar) necesitan un servidor (`next dev` / `next start`).
}

module.exports = nextConfig
