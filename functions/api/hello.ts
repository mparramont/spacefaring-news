import backendModule from "../../pkg/backend.wasm";

type BackendExports = {
  memory: WebAssembly.Memory;
  hello_fragment_ptr: () => number;
  hello_fragment_len: () => number;
};

let backendReady: Promise<BackendExports> | undefined;

async function getBackend() {
  backendReady ??= WebAssembly.instantiate(backendModule).then((instance) => {
    return instance.exports as BackendExports;
  });

  return backendReady;
}

function renderHelloFragment(exports: BackendExports) {
  const ptr = exports.hello_fragment_ptr();
  const len = exports.hello_fragment_len();
  const bytes = new Uint8Array(exports.memory.buffer, ptr, len);

  return new TextDecoder().decode(bytes);
}

export const onRequestGet: PagesFunction = async () => {
  const backend = await getBackend();

  return new Response(renderHelloFragment(backend), {
    headers: {
      "content-type": "text/html;charset=UTF-8",
      "cache-control": "no-store",
    },
  });
};
