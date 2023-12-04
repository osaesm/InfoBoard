/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'api.weather.gov',
                port: '',
                pathname: '/icons/**',
            }
        ]
    }
}

module.exports = nextConfig
