# node-deep-thinking-note
这个仓库用来记录对node的架构上的细节的理解，可以解决市面上大多数的疑惑，也可以纠正市面上大多数的错误

写在前面，这个项目只是从现象上说明node的一些细节，但是绝对不能代替阅读node源码

# 通过pbkdf2这个node的内置库，理解node如何使用v8和libuv

# node中的socketI/O(网络I/O)
对于一个node程序来说，网络I/O使用的是单线程的epoll

# node中的磁盘I/O或者加密计算
node会使用libuv中的提供的线程池中的线程来处理

# 数据库访问属于socketI/O

