import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    stages: [
        { duration: '10s', target: 10 },  // ramp-up a 10 usuarios
        { duration: '20s', target: 10 },  // mantener 10 usuarios
        { duration: '10s', target: 0 },   // ramp-down
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'], // 95% de requests bajo 500ms
        http_req_failed: ['rate<0.05'],   // menos de 5% de errores
    },
};

const BASE_URL = 'http://api-gateway:3000';

export default function () {
    // Health check
    const healthRes = http.get(`${BASE_URL}/health`);
    check(healthRes, {
        'health status es 200': (r) => r.status === 200,
    });

    // Obtener productos
    const productsRes = http.get('http://product-service:3002/products');
    check(productsRes, {
        'products status es 200': (r) => r.status === 200,
    });

    // Crear usuario (carga variable con timestamp para evitar duplicados)
    const payload = JSON.stringify({
        name: `LoadTest User ${Date.now()}`,
        email: `loadtest${Date.now()}${Math.random()}@example.com`,
    });

    const params = {
        headers: { 'Content-Type': 'application/json' },
    };

    const createRes = http.post(`${BASE_URL}/users`, payload, params);
    check(createRes, {
        'create user status es 201': (r) => r.status === 201,
    });

    sleep(1);
}