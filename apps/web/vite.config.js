export default {
  server: {
    allowedHosts: ['students-relevant-tax-motion.trycloudflare.com'],
    proxy: {
      '/pilot/api/': {
        target: 'http://127.0.0.1:8000',
        bypass: (request) => /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(request.headers.host ?? '') ? undefined : false,
      },
    },
  },
};
