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
            },
            {
                protocol: 'https',
                hostname: 'forecast.weather.gov',
                port: '',
                pathname: '/newimages/**'
            }
        ]
    }
}

module.exports = nextConfig
