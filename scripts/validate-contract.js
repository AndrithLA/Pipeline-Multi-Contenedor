#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const servicePath = process.argv[2];
const contractPath = process.argv[3];

if (!servicePath || !contractPath) {
    console.error('Usage: validate-contract.js <service-path> <contract-path>');
    process.exit(1);
}

const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
const serviceFiles = fs.readdirSync(path.join(servicePath, 'src'));

console.log(`Validando contrato en ${servicePath}...`);

let errors = [];

contract.endpoints.forEach(endpoint => {
    let found = false;
    serviceFiles.forEach(file => {
        const content = fs.readFileSync(path.join(servicePath, 'src', file), 'utf8');
        // Convertimos /users/:id -> /users/ para buscar coincidencia parcial en el código
        const basePath = endpoint.path.split('/:')[0];
        if (content.includes(basePath) && content.includes(`.${endpoint.method}(`)) {
            found = true;
        }
    });

    if (!found) {
        errors.push(`Endpoint ${endpoint.method.toUpperCase()} ${endpoint.path} no implementado en ${servicePath}`);
    }
});

if (errors.length > 0) {
    console.error('Errores de contrato:');
    errors.forEach(e => console.error(' - ' + e));
    process.exit(1);
} else {
    console.log('Contrato válido');
    process.exit(0);
}