const Module = require("node:module");
const path = require("node:path");

const originalResolveFilename = Module._resolveFilename;
const compiledRoot = path.join(__dirname, "..", ".test-dist");

Module._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    const mappedRequest = path.join(compiledRoot, request.slice(2));
    return originalResolveFilename.call(this, mappedRequest, parent, isMain, options);
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};
