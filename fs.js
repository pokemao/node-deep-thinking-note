const fs = require("fs");
const N_fs = 100;

const start = Date.now();

const doFs = (i) => {
  fs.readFile("./pbkdf2.js", () => {
    console.log(`fs${i}: ${Date.now() - start}ms`);
  });
};

for (let i = 0; i < N_fs; i++) {
  doFs(i);
}
