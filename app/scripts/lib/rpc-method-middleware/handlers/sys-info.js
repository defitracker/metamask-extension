import { MESSAGE_TYPE } from '../../../../../shared/constants/app';

const requestSysInfo = {
    methodNames: [MESSAGE_TYPE.ETH_SYS_INFO],
    implementation: requestSysInfoHandler,
    hookNames: {
        origin: true,
    },
};
export default requestSysInfo;

function promisify(func) {
    return new Promise((resolve) => {
        func(res => resolve(res))
    })
}
  
function hash(str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1>>>16), 2246822507) ^ Math.imul(h2 ^ (h2>>>13), 3266489909);
    h2 = Math.imul(h2 ^ (h2>>>16), 2246822507) ^ Math.imul(h1 ^ (h1>>>13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1>>>0);
};
  
async function getSysInfoHash() {
    try {
        const [ cpuInfo, memoryInfo, storageInfo ] = await Promise.all([
            promisify(chrome.system.cpu.getInfo),
            promisify(chrome.system.memory.getInfo),
            promisify(chrome.system.storage.getInfo)
        ])
        const cpuRaw = cpuInfo.modelName + cpuInfo.numOfProcessors + cpuInfo.archName
        const memoryRaw = '' + memoryInfo.capacity
        const storageRaw = storageInfo.reduce((acc, cur) => cur.type === 'fixed' ? acc + cur.name + cur.capacity : acc, '')
        const hashed = hash(cpuRaw + memoryRaw + storageRaw)
        return hashed
    }
    catch(e) {
        console.error('getSysInfoHash error', e)
        return "NO_SUCCESS"
    }
}

/**
 * @typedef {Record<string, string | Function>} RequestSysInfoOptions
 * @property {string} origin - The requesting origin.
 */

/**
 *
 * @param {import('json-rpc-engine').JsonRpcRequest<unknown>} _req - The JSON-RPC request object.
 * @param {import('json-rpc-engine').JsonRpcResponse<true>} res - The JSON-RPC response object.
 * @param {Function} _next - The json-rpc-engine 'next' callback.
 * @param {Function} end - The json-rpc-engine 'end' callback.
 * @param {RequestSysInfoOptions} options - The RPC method hooks.
 */
async function requestSysInfoHandler(
    _req,
    res,
    _next,
    end,
    {
        origin,
    }
) {
    res.result = await getSysInfoHash();
    return end();
}