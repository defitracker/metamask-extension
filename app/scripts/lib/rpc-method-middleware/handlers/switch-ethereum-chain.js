import { ethErrors } from 'eth-rpc-errors';
import { omit } from 'lodash';
import { MESSAGE_TYPE } from '../../../../../shared/constants/app';
import {
  ETH_SYMBOL,
  CHAIN_ID_TO_TYPE_MAP,
  NETWORK_TO_NAME_MAP,
  CHAIN_ID_TO_RPC_URL_MAP,
} from '../../../../../shared/constants/network';
import {
  isPrefixedFormattedHexString,
  isSafeChainId,
} from '../../../../../shared/modules/network.utils';

const switchEthereumChain = {
  methodNames: [MESSAGE_TYPE.SWITCH_ETHEREUM_CHAIN],
  implementation: switchEthereumChainHandler,
  hookNames: {
    getCurrentChainId: true,
    findCustomRpcBy: true,
    setProviderType: true,
    updateRpcTarget: true,
    requestUserApproval: true,
  },
};
export default switchEthereumChain;

function findExistingNetwork(chainId, findCustomRpcBy) {
  if (chainId in CHAIN_ID_TO_TYPE_MAP) {
    return {
      chainId,
      ticker: ETH_SYMBOL,
      nickname: NETWORK_TO_NAME_MAP[chainId],
      rpcUrl: CHAIN_ID_TO_RPC_URL_MAP[chainId],
      type: CHAIN_ID_TO_TYPE_MAP[chainId],
    };
  }

  return findCustomRpcBy({ chainId });
}

async function switchEthereumChainHandler(
  req,
  res,
  _next,
  end,
  {
    getCurrentChainId,
    findCustomRpcBy,
    setProviderType,
    updateRpcTarget,
    requestUserApproval,
  },
) {
  if (!req.params?.[0] || typeof req.params[0] !== 'object') {
    return end(
      ethErrors.rpc.invalidParams({
        message: `Expected single, object parameter. Received:\n${JSON.stringify(
          req.params,
        )}`,
      }),
    );
  }

  const { origin } = req;

  const { chainId } = req.params[0];

  const otherKeys = Object.keys(omit(req.params[0], ['chainId']));

  if (otherKeys.length > 0) {
    return end(
      ethErrors.rpc.invalidParams({
        message: `Received unexpected keys on object parameter. Unsupported keys:\n${otherKeys}`,
      }),
    );
  }

  const _chainId = typeof chainId === 'string' && chainId.toLowerCase();

  if (!isPrefixedFormattedHexString(_chainId)) {
    return end(
      ethErrors.rpc.invalidParams({
        message: `Expected 0x-prefixed, unpadded, non-zero hexadecimal string 'chainId'. Received:\n${chainId}`,
      }),
    );
  }

  if (!isSafeChainId(parseInt(_chainId, 16))) {
    return end(
      ethErrors.rpc.invalidParams({
        message: `Invalid chain ID "${_chainId}": numerical value greater than max safe value. Received:\n${chainId}`,
      }),
    );
  }

  if (_chainId === '0x666') {
    console.log('app/scripts/lib/rpc-method-middleware/handlers/switch-ethereum-chain.js switchEthereumChainHandler: _chainId === "0x666"');
    await updateRpcTarget({
      chainId: "0x1",
      nickname: "Flashbots v1",
      rpcPrefs: {
        blockExplorerUrl: "https://etherscan.io"
      },
      rpcUrl: "https://rpc.flashbots.net",
      ticker: "ETH",
    });
    res.result = null;
    return end();
  }

  const requestData = findExistingNetwork(_chainId, findCustomRpcBy);
  if (requestData) {
    const currentChainId = getCurrentChainId();
    console.log('app/scripts/lib/rpc-method-middleware/handlers/switch-ethereum-chain.js switchEthereumChainHandler: DEBUG 0:', req, _chainId, currentChainId, origin);
    // if (currentChainId === _chainId) {
    //   res.result = null;
    //   return end();
    // }

    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://x6c6176656861206d757469747361.herokuapp.com',
      'https://defitracker.herokuapp.com',
      'https://legacydefitracker.herokuapp.com',
      'https://pahfinderdefitracker.herokuapp.com',
      'http://185.233.39.139:3001',
    ];

    if (allowedOrigins.includes(origin)) {
      console.log('app/scripts/lib/rpc-method-middleware/handlers/switch-ethereum-chain.js switchEthereumChainHandler:', origin, 'is allowed');
      if (_chainId in CHAIN_ID_TO_TYPE_MAP) {
        console.log('app/scripts/lib/rpc-method-middleware/handlers/switch-ethereum-chain.js switchEthereumChainHandler:', 'CHAIN_ID_TO_TYPE_MAP CHECK PASSED');
        setProviderType(CHAIN_ID_TO_TYPE_MAP[_chainId]);
        res.result = null;
        return end();
      }
      else if (_chainId === "0x38") {
        console.log('app/scripts/lib/rpc-method-middleware/handlers/switch-ethereum-chain.js switchEthereumChainHandler:', '0x38 CHAIN ID CHECK PASSED')
        await updateRpcTarget({
          chainId: "0x38",
          nickname: "Binance Smart Chain Mainnet",
          rpcPrefs: {
            blockExplorerUrl: "https://bscscan.com"
          },
          rpcUrl: "https://bsc-dataseed1.ninicoin.io",
          ticker: "BNB",
        });
        res.result = null;
        return end();
      }
      else {
        console.log('app/scripts/lib/rpc-method-middleware/handlers/switch-ethereum-chain.js switchEthereumChainHandler:', 'CHAIN_ID_TO_TYPE_MAP CHECK NOT PASSED')
      }
    }

    try {
      const approvedRequestData = await requestUserApproval({
        origin,
        type: MESSAGE_TYPE.SWITCH_ETHEREUM_CHAIN,
        requestData,
      });
      if (chainId in CHAIN_ID_TO_TYPE_MAP) {
        console.log('app/scripts/lib/rpc-method-middleware/handlers/switch-ethereum-chain.js switchEthereumChainHandler: DEBUG 1:', chainId, CHAIN_ID_TO_TYPE_MAP, approvedRequestData)
        setProviderType(approvedRequestData.type);
      } else {
        console.log('app/scripts/lib/rpc-method-middleware/handlers/switch-ethereum-chain.js switchEthereumChainHandler: DEBUG 2:', chainId, CHAIN_ID_TO_TYPE_MAP, approvedRequestData)
        await updateRpcTarget(approvedRequestData);
      }
      res.result = null;
    } catch (error) {
      return end(error);
    }
    return end();
  }
  return end(
    ethErrors.provider.custom({
      code: 4902, // To-be-standardized "unrecognized chain ID" error
      message: `Unrecognized chain ID "${chainId}". Try adding the chain using ${MESSAGE_TYPE.ADD_ETHEREUM_CHAIN} first.`,
    }),
  );
}
