import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    stages: [
        { duration: '10s', target: 10 },
        { duration: '20s', target: 10 },
        { duration: '10s', target: 0 },
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'],
        http_req_failed: ['rate<0.05'],
    },
};

const BASE_URL = 'http://api-gateway:3000';

export default function () {
    const healthRes = http.get(`${BASE_URL}/health`);
    check(healthRes, {
        'health status es 200': (r) => r.status === 200,
    });

    const productsRes = http.get('http://product-service:3002/products');
    check(productsRes, {
        'products status es 200': (r) => r.status === 200,
    });

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