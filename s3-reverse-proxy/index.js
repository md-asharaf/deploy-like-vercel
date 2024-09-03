const express = require('express');
const httpProxy = require('http-proxy');
const dotenv = require('dotenv');
dotenv.config();
console.log("BASE_PATH", process.env.AWS_S3_BASE_PATH);
const app = express();
const PORT = 8000;
const BASE_PATH = process.env.AWS_S3_BASE_PATH;
const proxy = httpProxy.createProxy();
app.use((req, res) => {
    const hostname = req.hostname;
    const subdomain = hostname.split('.')[0];
    const resolvesTo = `${BASE_PATH}/${subdomain}`;
    return proxy.web(req, res, { target: resolvesTo, changeOrigin: true });
})
proxy.on('proxyReq', (proxyReq, req, res) => {
    const url = req.url;
    if (url === '/')
        proxyReq.path += 'index.html'

})
app.listen(PORT, () => console.log(`Reverse Proxy Server is running on port ${PORT}`));