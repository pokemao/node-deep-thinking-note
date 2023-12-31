# node-deep-thinking-note
这个仓库用来记录对node的架构上的细节的理解，可以解决市面上大多数的疑惑，也可以纠正市面上大多数的错误

> 写在前面，这个项目只是从现象上说明node的一些细节，但是绝对不能代替阅读node源码

# 通过pbkdf2这个node的内置库crypto的函数，理解node如何使用v8和libuv

# 通过pbkdf2了解node的libuv线程池工作
默认node的libuv的线程池中会有四个线程
## 当我们使用了一个pbkdf2函数
```js
const crypto = require('crypto')

const start = Date.now()

crypto.pbkdf2('a', 'b', 100000, 512, 'sha512', () => {
    console.log(`1: ${Date.now() - start}ms`)
})
```
命令行打印的消耗时间为
```sh
1: 250ms
```
接下来我们将以这个时间作为参照值来看后面的调用
## 当我们使用了两个pbkdf2函数
```js
const crypto = require('crypto')

const start = Date.now()

crypto.pbkdf2('a', 'b', 100000, 512, 'sha512', () => {
    console.log(`1: ${Date.now() - start}ms`)
})

crypto.pbkdf2('a', 'b', 100000, 512, 'sha512', () => {
    console.log(`2: ${Date.now() - start}ms`)
})
```
命令行打印的消耗时间为
```sh
2: 267ms
1: 270ms
```
对于只使用了一个pbkdf2的情况，我们可以看出使用两个pbkdf2并不会让第二个pbkdf2的时间变成两倍，可以认为使用两个pbkdf2不会增加整篇代码的执行时间
而且我们可以看到一个偶然的显现就是2号pbkdf2的执行消耗时间比1号的执行消耗时间还要短，其实从量级上来说相差不大，可以认为他们是同时执行结束的
从这个例子就可以看出，这两个pbkdf2函数是并发执行的，他们同时使用了libuv中的两个线程
* 如果node是单线程，两个pbkdf2执行的时间图应该是
![node是单线程，两个pbkdf2执行的时间图](./README_img/单线程.png)
* 如果node是多线程的话，两个pbkdf2执行的时间图就会有两种可能了
![node是多线程，两个pbkdf2执行的时间图](./README_img/多线程.png)
这也是上面为什么会出现2号pbkdf2在1号pbkdf2之前完成的现象的原因了
## 当我们使用了四个pbkdf2函数
```js
const crypto = require('crypto')

const start = Date.now()

crypto.pbkdf2('a', 'b', 100000, 512, 'sha512', () => {
    console.log(`1: ${Date.now() - start}ms`)
})

crypto.pbkdf2('a', 'b', 100000, 512, 'sha512', () => {
    console.log(`2: ${Date.now() - start}ms`)
})

crypto.pbkdf2('a', 'b', 100000, 512, 'sha512', () => {
    console.log(`3: ${Date.now() - start}ms`)
})

crypto.pbkdf2('a', 'b', 100000, 512, 'sha512', () => {
    console.log(`4: ${Date.now() - start}ms`)
})
```
命令行打印的消耗时间为
```sh
3: 286ms
1: 296ms
2: 307ms
4: 307ms
```
可以看到四个pbkdf2函数依旧是并发执行
## 当我们使用了五个pbkdf2函数
```js
const crypto = require('crypto')

const start = Date.now()

crypto.pbkdf2('a', 'b', 100000, 512, 'sha512', () => {
    console.log(`1: ${Date.now() - start}ms`)
})

crypto.pbkdf2('a', 'b', 100000, 512, 'sha512', () => {
    console.log(`2: ${Date.now() - start}ms`)
})

crypto.pbkdf2('a', 'b', 100000, 512, 'sha512', () => {
    console.log(`3: ${Date.now() - start}ms`)
})

crypto.pbkdf2('a', 'b', 100000, 512, 'sha512', () => {
    console.log(`4: ${Date.now() - start}ms`)
})

crypto.pbkdf2('a', 'b', 100000, 512, 'sha512', () => {
    console.log(`5: ${Date.now() - start}ms`)
})
```
命令行打印的消耗时间为
```sh
3: 281ms
2: 295ms
1: 299ms
4: 300ms
5: 542ms
```
这时我们可以看到5号pbkdf2函数的执行时间变成了前面四个pbkdf2函数的两倍，原因是什么呢？
libuv底层的线程池中默认只有四个线程，如果我们只是注册四个pbkdf2，那么这四个pbkdf2会被分别分配给四个线程，每个线程执行一个pbkdf2函数
由于操作系统的公平调度能力，所以每个线程的分到的可用的时间片都是相同的，所以这个四个线程中的pbkdf2函数会几乎同时执行结束，且执行相同的时间
但是这里有五个pbkdf2函数，那怎么分配呢？
首先，前四个pbkdf2函数会依旧使用每个线程分配一个的模式，然后这四个线程还是会被操作系统公平调度
直到这四个线程中有一个线程执行完了它的pbkdf2函数，这个时候这个线程就空闲了，libuv会从线程池中取出这个空闲的线程分配给第五个pbkdf2函数
所以这第五个pbkdf2函数一定会最后执行，前面四个pbkdf2函数的执行结束的顺序可能会变，但是这第五个一定是最后一个执行的且是最后一个执行完毕的
用时间图来描述的话就是下面的情况
![5个pbkdf2](./README_img/5个pbkdf2.png)
## 更改libuv线程池中线程的数量为5个
```js
process.env.UV_THREADPOOL_SIZE = 5

const crypto = require('crypto')

const start = Date.now()

crypto.pbkdf2('a', 'b', 100000, 512, 'sha512', () => {
    console.log(`1: ${Date.now() - start}ms`)
})

crypto.pbkdf2('a', 'b', 100000, 512, 'sha512', () => {
    console.log(`2: ${Date.now() - start}ms`)
})

crypto.pbkdf2('a', 'b', 100000, 512, 'sha512', () => {
    console.log(`3: ${Date.now() - start}ms`)
})

crypto.pbkdf2('a', 'b', 100000, 512, 'sha512', () => {
    console.log(`4: ${Date.now() - start}ms`)
})

crypto.pbkdf2('a', 'b', 100000, 512, 'sha512', () => {
    console.log(`5: ${Date.now() - start}ms`)
})
```
命令行打印的消耗时间为
```sh
2: 325ms
3: 329ms
4: 343ms
5: 345ms
1: 346ms
```
我们把libuv中线程池的数量改成了，通过5个pbkdf2的执行时间可以看出，这五个pbkdf2函数被分配到了libuv中的5个线程上，在操作系统的公平调度下，这5个线程并发处理自己线程中的pbkdf2函数代码，几乎同时的处理完毕
用时间图来描述一下
![线程池中有五个线程将如何执行pbkdf2函数](./README_img/线程池中有五个线程.png)
## 在libuv线程池中线程的数量为5个的情况下开启6个pbkdf2函数
```js
process.env.UV_THREADPOOL_SIZE = 5

const crypto = require('crypto')

const start = Date.now()

crypto.pbkdf2('a', 'b', 100000, 512, 'sha512', () => {
    console.log(`1: ${Date.now() - start}ms`)
})

crypto.pbkdf2('a', 'b', 100000, 512, 'sha512', () => {
    console.log(`2: ${Date.now() - start}ms`)
})

crypto.pbkdf2('a', 'b', 100000, 512, 'sha512', () => {
    console.log(`3: ${Date.now() - start}ms`)
})

crypto.pbkdf2('a', 'b', 100000, 512, 'sha512', () => {
    console.log(`4: ${Date.now() - start}ms`)
})

crypto.pbkdf2('a', 'b', 100000, 512, 'sha512', () => {
    console.log(`5: ${Date.now() - start}ms`)
})

crypto.pbkdf2('a', 'b', 100000, 512, 'sha512', () => {
    console.log(`6: ${Date.now() - start}ms`)
})
```
命令行打印的消耗时间为
```sh
4: 337ms
3: 349ms
5: 349ms
2: 349ms
1: 357ms
6: 592ms
```
我们可以看到，"在libuv线程池中线程的数量为5个的情况下开启6个pbkdf2函数"和"在libuv线程池中线程的数量为4个(默认)的情况下开启5个pbkdf2函数"的效果如出一辙，基本上可以使用之前的解析来解释这个现象
## 总结
上面的内容实打实的说明了，node会使用线程池处理一些耗时任务
# 文件I/O也会使用到线程池
## 只使用fs的时间
代码
```js
const fs = require("fs");
const start = Date.now();
fs.readFile("./pbkdf2.js", () => {
  console.log(`fs: ${Date.now() - start}ms`);
});
```
命令行结果
```sh
fs: 4ms
```
我们从这里看到一次文件读取的速度是非常快的，那这个现象怎么能确定文件io会使用到线程池呢？
我们接着看
## 在fs之后开启pbkdf2
代码
```js
const crypto = require("crypto");
const fs = require("fs");
const N_hash = 4;

const start = Date.now();

fs.readFile("./pbkdf2.js", () => {
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
```
命令行结果
```sh
hash2: 1631ms
fs: 1641ms
hash3: 1662ms
hash4: 1672ms
hash1: 1680ms
```
为什么fs的时间从4ms变成了1641ms呢？解释了这个内容就能确定文件io会使用到线程池
在了解fs使用了线程池之前我们要先了解，fs.readFile其实做了两件事情
一件事是open，另一件事是read
这两件事情都会引起文件I/O发生系统调用
从而效果就是下面的样子
![read和pbkdf2](./README_img/read和pbkdf2.png)
在4ms之前，线程池中的线程在执行open，第一个pbkdf2，第二个pbkdf2，第三个pbkdf2
当open开始调用的时候，线程池中的线程1发现这个线程中的open会是一个使线程进入到阻塞态的系统调用，虽然这个阻塞的系统调用很快就能完成，但是node并不能判断这个时间是多久，所以node会让线程1在执行到阻塞态的系统调用的时候，让出线程1的执行能力，把线程1放回到线程池中，执行线程池队列里面的下一条任务。
也就是说线程1会在open执行完之后，继续执行线程池中的第四个pbkdf2，而open系统调用在打开完毕之后，会把read的任务加入到线程池的任务队列里面去，在线程池中有空闲线程的时候会去执行这个新加入的read任务
在open执行完毕之后，线程池中的线程就在执行第四个pbkdf2，第一个pbkdf2，第二个pbkdf2，第三个pbkdf2
从执行结果上看，第二个pbkdf2最先执行完毕，这个时候线程池中的线程3就空闲了，线程3就可以去执行线程池任务队列里面的read任务了
## 只open文件
```js
const crypto = require("crypto");
const fs = require("fs");
const N_hash = 4;

const start = Date.now();

fs.readFile("./pbkdf2.js", () => {
  console.log(`fs: ${Date.now() - start}ms`);
});

const doHash = (i) => {
  crypto.pbkdf2("a", "b", 100000, 512, "sha512", () => {
    console.log(`hash${i}: ${Date.now() - start}ms`);
  });
};

for (let i = 0; i < N_hash; i++) {
  doHash(i);
}
```
命令行结果
```sh
fs: 4ms
hash1: 1454ms
hash3: 1499ms
hash0: 1546ms
hash2: 1550ms
```
我们使用fs.open验证了fs.readFile是由open和read两个系统调用组成的
# 网络I/O不会使用到线程池
对于一个node程序来说，网络I/O使用的是单线程的epoll机制
## 开启四个请求
```js
const https = require("node:https");

const N = 4;

const start = Date.now();

const doRequest = (i) => {
  https
    .request("https://www.baidu.com", (scoket) => {
      scoket.on("data", () => {});
      scoket.on("end", () => {
        const end = Date.now();
        console.log(`request${i}: ${end - start}ms`);
      });
    })
    .end();
};

for (let i = 0; i < N; i++) {
  doRequest(i);
}
```
命令行结果
```sh
request1: 138ms
request3: 144ms
request0: 145ms
request2: 146ms
```
## 开启十个请求
```js
const https = require("node:https");

const N = 10;

const start = Date.now();

const doRequest = (i) => {
  https
    .request("https://www.baidu.com", (scoket) => {
      scoket.on("data", () => {});
      scoket.on("end", () => {
        const end = Date.now();
        console.log(`request${i}: ${end - start}ms`);
      });
    })
    .end();
};

for (let i = 0; i < N; i++) {
  doRequest(i);
}
```
命令行结果
```sh
request0: 158ms
request9: 159ms
request4: 160ms
request6: 161ms
request2: 162ms
request3: 163ms
request1: 165ms
request8: 166ms
request7: 167ms
```
通过四个请求和十个请求的对比发现没有什么延迟的现象，我们大致可以分析得出网络请求没有用到线程池，否则应该是request0-request3先完成(完成时间记为t0)，然后request4-request7再完成(完成时间记为t1 == 2 * t0)，最后是request8-request9(完成时间记为t2 == 3 * t0)
# 多进程模型
## 单进程的node服务器存在的缺陷
如果一个node服务器在响应会执行cpu密集型任务的请求的时候会发生什么事情
单进程服务器代码：
```js
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
```
后续操作：
1. 打开两个浏览器的页
2. 第一个页面请求http://localhost:8090，几乎同时在第二个页面请求http://localhost:8090
3. 观察请求返回的时间
效果：
![单进程node服务器接受两个cpu密集型请求](./README_img/单进程node服务器接受两个cpu密集型请求.png)
现象分析：
![单进程node服务器响应时间分析](./README_img/单进程node服务器响应时间分析.png)
从图片中可以看出，由于node是使用epoll来在一个单线程处理http.createServer(callback)中注册的callback的
详细说就是一个请求到来的时候，node会在事件循环的poll阶段中，通过epoll知道这个请求的到来，然后也是通过epoll获取到这个请求对应的sokcet的fd(如果有多个请求同时到来会返回多个fd)，然后继续读取一个fd中的请求内容，然后调用callback处理这个请求，如果epoll返回了多个fd，那么久继续读取一个fd中的请求内容，然后调用callback处理这个请求，循环往复，直到所有的fd都被处理完毕。所以说每个请求的poll阶段中一个接着一个被处理的(处理的方式就是调用回调函数callback)，但是node执行时间循环是单线程执行的，所以在上面的例子中，第一个请求的callback需要5s完成然后返回给客户端，只有当一个请求的callback函数执行完毕之后事件循环线程才能继续执行第二个请求的callback函数，这个函数也需要5s，完成后返回响应给客户端，所以也就形成了上面的时间序列图像
解决这个问题的方式：
1. 对cpu密集型的任务使用进程间交互来解决
2. 使用多进程架构
上面的两个方法应该同时使用以提高node服务器的QPS
## 多进程的node服务器
多进程服务器代码：
```js
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
```
启动的时候的控制台打印
```sh
Primary 25468 is running
Worker 25474 started and listened in 8999
Worker 25472 started and listened in 8999
Worker 25473 started and listened in 8999
Worker 25469 started and listened in 8999
Worker 25470 started and listened in 8999
Worker 25476 started and listened in 8999
Worker 25471 started and listened in 8999
Worker 25475 started and listened in 8999
```
后续操作和之前的单进程node服务器的操作相同：
1. 打开两个浏览器的页
2. 第一个页面请求http://localhost:8090，几乎同时在第二个页面请求http://localhost:8090
3. 观察请求返回的时间
效果：
1. 服务器控制台输出
```sh
Worker 25474 started to server
Worker 25472 started to server
```
表示第一个浏览器的请求被工作进程25474处理，第二个浏览器的请求被工作进程25472处理
2. 浏览器的devtools的network时间分析
![单进程node服务器接受两个cpu密集型请求](./README_img/单进程node服务器接受两个cpu密集型请求.png)
从左右两次请求的发起到响应时间都在5s左右可以看出，多进程node服务器并请求间相互阻塞的问题，并且我们还看到第二个浏览器发起的请求还比第一个浏览器发起的请求的响应时间要短呢！由于这里面是两个进程在处理这两个请求，所以也就没有什么手动切换浏览器的时间了
现象分析：
![多进程node服务器响应时间分析](./README_img/多进程node服务器响应时间分析.png)
这次客户端发起的两个请求分别被不同的进程处理，每一个进程内部有各自的事件循环线程，所以相互之间不会阻塞，都能在收到请求之后立即开始5s的处理(执行callback函数)
# epoll是什么，对标nginx
## 使用epoll编程的C代码
## nginx内部使用epoll
# epoll在node时间循环的什么阶段，epoll都会处理什么？
## poll
# 使用多进程充分利用CPU资源
由于node是单线程，所以可以多开几个线程
# cluster模块
# pm2


从哪里开始讲起呢？
就从一个例子开始讲起
为什么要在node里面使用多进程？
```js
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
```

poll事件阶段
epoll_pwait 细节处理， socket
nfds
read
unix域 socket epoll
watcher

node 网络请求的callback是单线程执行
多进程，多线程 libuv 默认线程池里面的四个线程是没有关系的
cluster ==》 child_process()


多进程监听同一个端口的现象，很神奇是吗？
ng， static静态文件，worker

process.send('server', socket tcpserver udpserver)

fd
fork子进程 复制父进程的pcb task_struct exceve()加载器
子进程可以看到父进程中所有的fd
epoll fd

高并发 抢占
cluster

负载均衡。。。

部署node项目
node ...

单进程项目 使用 pm2

整个的流程

信号

进程挂了即时开启
