const Koa = require('koa')

const app = new Koa()

app.use((ctx, next) => {
  if(ctx.url !== '/') {
    ctx.body = 'no'
    return 
  }
  const start = Date.now()
  let end;
  // 模拟cpu密集型的任务
  // 使用下面的while循环，所有的请求服务器都要处理5s之后，才能返回
  while((end = Date.now()) - start < 5000){}
  ctx.body = "5s gone"
})

app.listen(8090, () => {
  console.log('listen in 8090');
})
