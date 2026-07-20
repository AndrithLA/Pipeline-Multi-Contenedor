const express = require('express');
const axios = require('axios');
const CircuitBreaker = require('opossum');

const app = express();
const port = process.env.PORT || 3000;

    app.use(express.json());

    const userServiceBreaker = new CircuitBreaker(
        async (req) => {
            const response = await axios({
                method: req.method,
                url: `http://user-service:3001${req.url}`,
                data: req.body,
                headers: { 'Content-Type': 'application/json' },
                validateStatus: () => true // no lances error en 4xx, los manejamos nosotros
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
                headers: { 'Content-Type': 'application/json' }
            });
            return response.data;
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

    // Endpoint de métricas para Prometheus
    app.get('/metrics', (req, res) => {
        res.json({
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            circuitBreakers: {
                userService: userServiceBreaker.status,
                productService: productServiceBreaker.status
            }
        });
    });

    app.listen(port, () => {
        console.log(`API Gateway running on port ${port}`);
    });

    module.exports = app;