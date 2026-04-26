import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import http from 'node:http'

const backendTarget = process.env.VITE_BACKEND_TARGET || 'http://localhost:3001'

function parseTarget(target) {
  const url = new URL(target)
  return {
    protocol: url.protocol,
    hostname: url.hostname,
    port: Number(url.port || (url.protocol === 'https:' ? 443 : 80))
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
    })
    req.on('end', () => {
      if (!data) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(data))
      } catch {
        resolve({})
      }
    })
    req.on('error', reject)
  })
}

function forwardGetWithBody(pathname, payload) {
  const target = parseTarget(backendTarget)

  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload || {})
    const request = http.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        method: 'GET',
        path: pathname,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      },
      (response) => {
        let raw = ''
        response.on('data', (chunk) => {
          raw += chunk
        })
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode || 500,
            body: raw || '{}'
          })
        })
      }
    )

    request.on('error', reject)
    request.write(body)
    request.end()
  })
}

function backendCompatPlugin() {
  return {
    name: 'backend-compat-get-body',
    configureServer(server) {
      server.middlewares.use('/api/login', async (req, res, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }

        try {
          const payload = await readJsonBody(req)
          const response = await forwardGetWithBody('/login', payload)
          res.statusCode = response.statusCode
          res.setHeader('Content-Type', 'application/json')
          res.end(response.body)
        } catch {
          res.statusCode = 503
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: false, message: 'No se pudo conectar con el backend.' }))
        }
      })

      server.middlewares.use('/api/logout', async (req, res, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }

        try {
          const payload = await readJsonBody(req)
          const response = await forwardGetWithBody('/logout', payload)
          res.statusCode = response.statusCode
          res.setHeader('Content-Type', 'application/json')
          res.end(response.body)
        } catch {
          res.statusCode = 503
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: false, message: 'No se pudo conectar con el backend.' }))
        }
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), backendCompatPlugin()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
