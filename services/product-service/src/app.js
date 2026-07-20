const express = require('express');

const app = express();
const port = process.env.PORT || 3002;

app.use(express.json());

// Datos en memoria para simplicidad
let products = [
    { id: 1, name: 'Laptop', price: 999.99, stock: 15 },
    { id: 2, name: 'Mouse', price: 25.50, stock: 100 }
];
let nextId = 3;

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

app.get('/products', (req, res) => {
    res.json(products);
});

app.get('/products/:id', (req, res) => {
    const product = products.find(p => p.id === parseInt(req.params.id));
    if (!product) {
        return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
});

app.post('/products', (req, res) => {
    const { name, price, stock } = req.body;
    const product = { id: nextId++, name, price, stock };
    products.push(product);
    res.status(201).json(product);
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
    console.log(`Product Service running on port ${port}`);
});

    

module.exports = app;