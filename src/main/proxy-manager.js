const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const log = require('electron-log');

let proxyList = [];
let currentIndex = 0;
let useRotation = false;

function setProxies(proxies, rotate = false) {
  proxyList = proxies.filter(p => p && p.trim());
  useRotation = rotate;
  currentIndex = 0;
  log.info(`Proxy list set: ${proxyList.length} proxies, rotation: ${rotate}`);
}

function getNextProxy() {
  if (!proxyList.length) return null;
  if (!useRotation) return proxyList[0];

  const proxy = proxyList[currentIndex % proxyList.length];
  currentIndex++;
  return proxy;
}

async function testProxy(proxyUrl) {
  try {
    if (!proxyUrl || !proxyUrl.trim()) {
      return { success: false, message: 'Empty proxy URL' };
    }

    const agent = new HttpsProxyAgent(proxyUrl);
    const start = Date.now();

    const response = await axios.get('https://api.ipify.org?format=json', {
      httpsAgent: agent,
      httpAgent: agent,
      timeout: 10000,
      proxy: false
    });

    const latency = Date.now() - start;
    const ip = response.data?.ip || 'unknown';

    return {
      success: true,
      message: `Proxy working. IP: ${ip} | Latency: ${latency}ms`,
      ip,
      latency
    };
  } catch (err) {
    log.warn('Proxy test failed:', err.message);
    return { success: false, message: `Proxy failed: ${err.message}` };
  }
}

function parseProxyString(proxyStr) {
  proxyStr = proxyStr.trim();
  if (!proxyStr.startsWith('http://') && !proxyStr.startsWith('https://') && !proxyStr.startsWith('socks')) {
    proxyStr = `http://${proxyStr}`;
  }
  return proxyStr;
}

module.exports = { setProxies, getNextProxy, testProxy, parseProxyString };
