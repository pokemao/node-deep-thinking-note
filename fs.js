const https = require("node:https");
const crypto = require("crypto");
const fs = require("fs");
const N_request = 10;
const N_hash = 4;
const start = Date.now();

const doRequest = (i) => {
  https
    .request("https://www.baidu.com", (scoket) => {
      scoket.on("data", () => {});
      scoket.on("close", () => {
        const end = Date.now();
        console.log(`request${i}: ${end - start}ms`);
      });
    })
    .end();
};

fs.open("./https.js", () => {
  console.log(`fs: ${Date.now() - start}ms`);
});

for (let i = 0; i < N_request; i++) {
  doRequest(i);
}

const doHash = (i) => {
  crypto.pbkdf2("a", "b", 100000, 512, "sha512", () => {
    console.log(`hash${i}: ${Date.now() - start}ms`);
  });
};

for (let i = 0; i < N_hash; i++) {
  doHash(i);
}
