const Koa = require('koa')
const cluster = require('node:cluster')
const numCPUs = require('node:os').availableParallelism();
const process = require('node:process');

if(cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running`);

  // Fork workers.
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`);
  });
}else {
  const app = new Koa()

  app.use((ctx, next) => {
    if(ctx.url !== '/') {
      ctx.body = 'no'
      return 
    }
    console.log(`Worker ${process.pid} started to server`);
    const start = Date.now()
    let end;
    // 模拟cpu密集型的任务
    // 使用下面的while循环，所有的请求服务器都要处理5s之后，才能返回
    while((end = Date.now()) - start < 5000){}
    ctx.body = "5s gone"
  })
  
  app.listen(8999, () => {
    console.log(`Worker ${process.pid} started and listened in 8999`);
  })
}
