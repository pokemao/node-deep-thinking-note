const https = require("node:https");

const N = 10;

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

for (let i = 0; i < N; i++) {
  doRequest(i);
}
