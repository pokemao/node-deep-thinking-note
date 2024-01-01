const crypto = require("crypto");
const fs = require("fs");
const N_hash = 4;

const start = Date.now();

fs.open("./pbkdf2.js", () => {
  console.log(`fs: ${Date.now() - start}ms`);
});

const doHash = (i) => {
  crypto.pbkdf2("a", "b", 100000, 512, "sha512", () => {
    console.log(`hash${i}: ${Date.now() - start}ms`);
  });
};

for (let i = 1; i <= N_hash; i++) {
  doHash(i);
}
