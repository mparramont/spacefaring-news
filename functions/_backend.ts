import backendModule from "../pkg/backend.wasm";

type BackendExports = {
  memory: WebAssembly.Memory;
  latest_issue_ptr: () => number;
  latest_issue_len: () => number;
  subscribe_success_ptr: () => number;
  subscribe_success_len: () => number;
  subscribe_invalid_ptr: () => number;
  subscribe_invalid_len: () => number;
};

let backendReady: Promise<BackendExports> | undefined;

async function getBackend() {
  backendReady ??= WebAssembly.instantiate(backendModule).then((instance) => {
    return instance.exports as BackendExports;
  });

  return backendReady;
}

function readFragment(exports: BackendExports, ptr: number, len: number) {
  const bytes = new Uint8Array(exports.memory.buffer, ptr, len);

  return new TextDecoder().decode(bytes);
}

export async function renderLatestIssue() {
  const backend = await getBackend();

  return readFragment(backend, backend.latest_issue_ptr(), backend.latest_issue_len());
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

