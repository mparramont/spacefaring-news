import backendModule from "../pkg/backend.wasm";

let backendReady;

async function getBackend() {
  backendReady ??= WebAssembly.instantiate(backendModule).then((instance) => instance.exports);

  return backendReady;
}

function readFragment(exports, ptr, len) {
  const bytes = new Uint8Array(exports.memory.buffer, ptr, len);

  return new TextDecoder().decode(bytes);
}

export async function renderSubscribeSuccess() {
  const backend = await getBackend();

  return readFragment(
    backend,
    backend.subscribe_success_ptr(),
    backend.subscribe_success_len(),
  );
}

export async function renderSubscribeInvalid() {
  const backend = await getBackend();

  return readFragment(
    backend,
    backend.subscribe_invalid_ptr(),
    backend.subscribe_invalid_len(),
  );
}

export async function renderSubscribeDuplicate() {
  const backend = await getBackend();

  return readFragment(
    backend,
    backend.subscribe_duplicate_ptr(),
    backend.subscribe_duplicate_len(),
  );
}
