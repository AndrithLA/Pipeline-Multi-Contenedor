const express = require('express');
const axios = require('axios');
const CircuitBreaker = require('opossum');
const client = require('prom-client');

const app = express();
const port = process.env.PORT || 3000;

    app.use(express.json());

    // ==== Métricas de Prometheus ====
    const register = new client.Registry();
    client.collectDefaultMetrics({ register });

    const httpRequestCounter = new client.Counter({
        name: 'http_requests_total',
        help: 'Total de peticiones HTTP recibidas por el gateway',
        labelNames: ['method', 'route', 'status_code'],
        registers: [register]
    });

    const httpRequestDuration = new client.Histogram({
        name: 'http_request_duration_seconds',
        help: 'Duracion de las peticiones HTTP en segundos',
        labelNames: ['method', 'route', 'status_code'],
        buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
        registers: [register]
    });

    app.use((req, res, next) => {
        const endTimer = httpRequestDuration.startTimer();
        res.on('finish', () => {
            const route = req.route ? req.route.path : req.path;
            httpRequestCounter.inc({ method: req.method, route, status_code: res.statusCode });
            endTimer({ method: req.method, route, status_code: res.statusCode });
        });
        next();
    });

    // Configuración de circuit breakers
    const userServiceBreaker = new CircuitBreaker(
        async (req) => {
            const response = await axios({
                method: req.method,
                url: `http://user-service:3001${req.url}`,
                data: req.body,
                headers: { 'Content-Type': 'application/json' },
                validateStatus: () => true
            });
            return { status: response.status, data: response.data };
        },
        { timeout: 3000, errorThresholdPercentage: 50, resetTimeout: 10000 }
    );

    const productServiceBreaker = new CircuitBreaker(
        async (req) => {
            const response = await axios({
                method: req.method,
                url: `http://product-service:3002${req.url}`,
                data: req.body,
                headers: { 'Content-Type': 'application/json' },
                validateStatus: () => true
            });
            return { status: response.status, data: response.data };
        },
        { timeout: 3000, errorThresholdPercentage: 50, resetTimeout: 10000 }
    );

    // Middleware de logging
    app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
        next();
    });

    // Health check del gateway
    app.get('/health', (req, res) => {
        res.json({
            status: 'healthy',
            services: {
                userService: userServiceBreaker.status.stats,
                productService: productServiceBreaker.status.stats
            }
        });
    });

    // Ruteo con circuit breakers
    app.all(['/users', '/users/*'], async (req, res) => {
        try {
            const result = await userServiceBreaker.fire(req);
            res.status(result.status).json(result.data);
        } catch (error) {
            res.status(503).json({
                error: 'Service Unavailable',
                message: 'User service is currently unavailable'
            });
        }
    });

    app.all(['/products', '/products/*'], async (req, res) => {
        try {
            const result = await productServiceBreaker.fire(req);
            res.status(result.status).json(result.data);
        } catch (error) {
            res.status(503).json({
                error: 'Service Unavailable',
                message: 'Product service is currently unavailable'
            });
        }
    });

    // Endpoint de métricas para Prometheus (formato texto estándar)
    app.get('/metrics', async (req, res) => {
        try {
            res.set('Content-Type', register.contentType);
            res.end(await register.metrics());
        } catch (error) {
            res.status(500).end(error.message);
        }
    });

    // Endpoint de debug con detalle de circuit breakers en JSON (uso humano)
    app.get('/debug/circuit-breakers', (req, res) => {
        res.json({
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            circuitBreakers: {
                userService: userServiceBreaker.status,
                productService: productServiceBreaker.status
            }
        });
    });

    if (require.main === module) {
        app.listen(port, () => {
            console.log(`API Gateway running on port ${port}`);
        });
    }

    module.exports = app;