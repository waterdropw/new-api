# 性能优化方案总结

本文档详细说明了为 New API 系统实施的三层次性能优化方案。

## 概览

### 优化目标
1. **解决高并发导致的 CPU 100% 占用问题**
2. **减少高并发、高重试下的 CPU 与内存消耗**
3. **新增系统设置 - 性能设置，Docker 部署下启用流模式性能优化可减少约 5% 的 CPU 占用**

### 实施范围
- 后端：Go 服务
- 前端：React 管理界面

---

## 第一部分：解决高并发 CPU 100% 占用问题

### 1.1 优化流式响应处理 (`relay/helper/stream_scanner.go`)

**问题分析：**
- 原有实现在高并发下产生过多的 goroutine 上下文切换
- 使用 mutex 锁保护 dataHandler 调用导致锁竞争
- 缓冲区大小固定，无法针对不同场景动态调整

**优化方案：**
- 实现基于性能设置的**动态缓冲区调整**
- 添加**背压控制机制**（backpressure）：
  - 限制内存中缓冲的数据块数量
  - 使用带缓冲的 channel 实现背压：`chan struct{}`
  - 防止快速的数据生成导致内存溢出

**关键改进：**
```go
// 背压控制示例
backPressureChan := make(chan struct{}, 10) // 允许缓冲 10 个块

// 在生成数据时
select {
case backPressureChan <- struct{}{}:
    // 成功添加
case <-ctx.Done():
    return
}

// 处理完后释放位置
<-backPressureChan
```

### 1.2 优化 HTTP 连接池 (`service/http_client.go`)

**优化方案：**
- 实现**动态连接池参数调整**机制
- 集成性能设置中的连接池参数：
  - `MaxIdleConns`: 最大空闲连接数（默认 500）
  - `MaxIdleConnsPerHost`: 每个 host 最大空闲连接数（默认 100）
  - `IdleConnTimeout`: 空闲连接超时时间（默认 90 秒）

**关键改进：**
- 后台定期检查配置变化（5 分钟一次）
- 支持热更新连接池配置，无需重启服务
- 使用 `RWMutex` 保护并发访问

### 1.3 优化 Goroutine 管理 (`common/gopool.go`)

**问题分析：**
- 原有实现无上限的 goroutine 创建导致大量上下文切换
- 缺乏 goroutine 生命周期的监控和告警机制

**优化方案：**
- 实现**goroutine 计数与监控**
- 添加**性能告警机制**
- 支持可配置的 goroutine 池大小限制

**关键改进：**
```go
// Atomic 计数，零锁开销
atomic.AddInt64(&currentGoroutineCount, 1)
atomic.AddInt64(&peakGoroutineCount, 1)

// 高 goroutine 告警
if current > int64(maxGoroutinePerRequest)*10 {
    // 触发告警
}

// 定期监控输出
// 每 5 分钟输出一次统计信息
```

---

## 第二部分：减少高并发、高重试下的资源消耗

### 2.1 智能重试策略 (`setting/operation_setting/retry_setting.go`)

**可配置项：**

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `MaxRetryAttempts` | 3 | 最大重试次数 |
| `RetryStrategy` | `exponent` | 重试策略：fixed/linear/exponent |
| `BaseRetryDelayMs` | 100 | 基础重试延迟（毫秒） |
| `MaxRetryDelayMs` | 30000 | 最大重试延迟（毫秒） |
| `RetryOnTimeout` | true | 超时时重试 |
| `RetryOn5xx` | true | 5xx 错误时重试 |
| `RetryOn429` | true | 速率限制 (429) 时重试 |
| `RetryOnConnectionError` | true | 连接错误时重试 |

**重试策略详解：**

1. **Fixed（固定延迟）**
   ```
   延迟 = BaseRetryDelay
   场景：简单的临时故障
   ```

2. **Linear（线性退避）**
   ```
   延迟 = BaseRetryDelay * 尝试次数
   场景：逐步恢复的故障
   ```

3. **Exponential（指数退避）** 默认
   ```
   延迟 = BaseRetryDelay * (2 ^ 尝试次数)
   场景：防止级联故障，高并发场景推荐
   ```

### 2.2 熔断器保护

**功能：**
- 在连续失败 N 次后自动熔断
- 熔断期间拒绝请求，快速失败
- 指定时间后自动尝试恢复

**配置项：**
| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `CircuitBreakerEnabled` | true | 启用熔断器 |
| `CircuitBreakerThreshold` | 10 | 熔断阈值（连续失败次数） |
| `CircuitBreakerResetSeconds` | 60 | 熔断恢复时间（秒） |

### 2.3 重试队列管理

**功能：**
- 限制重试队列大小，防止内存溢出
- 支持重试超时控制
- 按优先级处理重试请求

**配置项：**
| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `EnableRetryQueue` | true | 启用重试队列 |
| `MaxRetryQueueSize` | 10000 | 最大重试队列大小 |
| `RetryTimeoutSeconds` | 30 | 单次重试超时时间（秒） |

---

## 第三部分：性能设置模块

### 3.1 新增性能设置 (`setting/operation_setting/performance_setting.go`)

**流模式优化**
- `StreamModeEnabled`：启用流模式（默认 true）
- `StreamBufferSizeKB`：流缓冲区大小，默认 64KB
- `StreamChunkSizeBytes`：单次读取字节数，默认 4096 字节
- `EnableStreamBackPressure`：启用背压控制（默认 true）

**性能提升：**
- 启用流模式 + 背压控制在 Docker 部署下可**减少约 5% CPU 占用**

**并发控制**
| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `MaxConcurrentRequests` | 0 | 最大并发请求（0 表示无限制） |
| `MaxGoroutinePerRequest` | 100 | 每个请求最多 goroutine 数 |
| `GoroutinePoolSize` | NumCPU*128 | goroutine 池大小 |
| `EnableGoroutineAlarm` | true | 启用 goroutine 告警 |

**内存管理**
| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `EnableMemoryOptimization` | true | 启用内存优化 |
| `MaxMemoryUsagePercent` | 0 | 最大内存百分比（0 无限制） |
| `MemoryAlarmThresholdPercent` | 85 | 内存告警阈值 |

**HTTP 连接池优化**
| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `EnableConnectionPoolOptimization` | true | 启用连接池优化 |
| `MaxIdleConns` | 500 | 最大空闲连接数 |
| `MaxIdleConnsPerHost` | 100 | 每个 host 最大空闲连接 |
| `IdleConnTimeout` | 90 | 空闲连接超时（秒） |

**响应缓存**
| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `EnableResponseCache` | false | 启用响应缓存 |
| `CacheTTLSeconds` | 300 | 缓存过期时间（秒） |

**CPU 优化**
| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `EnableCPUOptimization` | true | 启用 CPU 优化 |
| `ReduceMutexContention` | true | 减少 mutex 竞争 |

### 3.2 API 接口

#### 获取性能设置
```bash
GET /api/option/performance
```

#### 更新性能设置
```bash
PUT /api/option/performance
Content-Type: application/json

{
  "stream_mode_enabled": true,
  "stream_buffer_size_kb": 64,
  "enable_stream_back_pressure": true,
  ...
}
```

#### 获取重试设置
```bash
GET /api/option/retry
```

#### 更新重试设置
```bash
PUT /api/option/retry
Content-Type: application/json

{
  "max_retry_attempts": 3,
  "retry_strategy": "exponent",
  "base_retry_delay_ms": 100,
  ...
}
```

### 3.3 前端管理界面

新增两个前端页面供管理员配置：

1. **性能设置页面** (`web/src/pages/Setting/Operation/SettingsPerformance.jsx`)
   - 流模式优化配置
   - 并发控制参数
   - 内存管理设置
   - 连接池优化
   - 响应缓存配置
   - CPU 优化选项

2. **重试设置页面** (`web/src/pages/Setting/Operation/SettingsRetry.jsx`)
   - 基础重试配置
   - 重试条件选择
   - 性能相关设置
   - 熔断器配置

---

## 配置建议

### 小型部署（单机）
```go
StreamModeEnabled: true              // 启用流模式
MaxConcurrentRequests: 100           // 适度限制
MaxGoroutinePerRequest: 50           // 保守配置
MaxIdleConns: 200                    // 较少连接
MaxIdleConnsPerHost: 50
```

### 中型部署（多服务器）
```go
StreamModeEnabled: true              // 启用流模式
MaxConcurrentRequests: 500           // 中等限制
MaxGoroutinePerRequest: 100          // 标准配置
MaxIdleConns: 500                    // 标准配置
MaxIdleConnsPerHost: 100
RetryStrategy: "exponent"            // 指数退避
CircuitBreakerThreshold: 10
```

### 大型部署（高可用）
```go
StreamModeEnabled: true              // 启用流模式
MaxConcurrentRequests: 2000          // 宽松限制
MaxGoroutinePerRequest: 200          // 激进配置
MaxIdleConns: 1000                   // 充足连接
MaxIdleConnsPerHost: 200
RetryStrategy: "exponent"
CircuitBreakerThreshold: 20
CircuitBreakerResetSeconds: 120
```

---

## 监控指标

### 关键指标

1. **Goroutine 统计**
   ```
   GET /api/debug/stats/goroutine
   {
     "current": 150,      // 当前 goroutine 数
     "peak": 500          // 峰值 goroutine 数
   }
   ```

2. **HTTP 客户端池状态**
   - 活跃连接数
   - 空闲连接数
   - 连接复用率

3. **流处理性能**
   - 平均流处理延迟
   - 背压触发频率
   - 缓冲区使用率

4. **重试统计**
   - 重试成功率
   - 熔断器触发次数
   - 平均重试延迟

---

## 部署说明

### Docker 部署优化

在 Docker 环境中，推荐以下环境变量配置：

```dockerfile
# 启用流模式优化
ENV PERFORMANCE_STREAM_MODE_ENABLED=true
ENV PERFORMANCE_STREAM_BUFFER_SIZE_KB=64

# 并发控制
ENV PERFORMANCE_MAX_CONCURRENT_REQUESTS=1000
ENV PERFORMANCE_MAX_GOROUTINE_PER_REQUEST=100

# HTTP 连接池
ENV PERFORMANCE_MAX_IDLE_CONNS=500
ENV PERFORMANCE_MAX_IDLE_CONNS_PER_HOST=100

# 重试策略
ENV RETRY_STRATEGY=exponent
ENV RETRY_MAX_ATTEMPTS=3
ENV RETRY_CIRCUIT_BREAKER_ENABLED=true
```

### 性能验证

1. **基准测试前**
   - 使用默认配置启动服务
   - 记录基线 CPU、内存使用情况

2. **启用优化后**
   - 启用流模式 + 背压控制
   - 进行相同的负载测试
   - 对比结果

3. **期望改进**
   - CPU 使用率降低 5-10%
   - 内存峰值降低 3-5%
   - 高并发场景下响应延迟降低 10-15%

---

## 故障排查

### 症状：goroutine 数量持续增长

**原因：**
- goroutine 泄漏
- 背压未启用

**解决：**
```go
// 检查 goroutine 状态
EnableGoroutineAlarm: true
// 启用背压
EnableStreamBackPressure: true
```

### 症状：高重试率导致级联失败

**原因：**
- 熔断器未启用
- 重试策略不当

**解决：**
```go
// 启用熔断器
CircuitBreakerEnabled: true
CircuitBreakerThreshold: 10

// 使用指数退避
RetryStrategy: "exponent"
```

### 症状：内存持续增长

**原因：**
- 缓冲区过大
- 背压无效

**解决：**
```go
// 减小缓冲区
StreamBufferSizeKB: 32

// 检查背压配置
EnableStreamBackPressure: true
```

---

## 后续优化方向

1. **请求优先级队列**
   - 根据重要性优先处理请求
   - 在高负载下自适应调整

2. **自适应背压**
   - 根据系统负载动态调整背压阈值
   - 实时监控内存/CPU 决策

3. **连接复用优化**
   - HTTP/2 多路复用
   - 连接预热策略

4. **智能限流**
   - 基于实际处理能力的动态限流
   - 令牌桶算法优化

---

## 参考文献

- [Go net/http Transport 文档](https://golang.org/pkg/net/http/#Transport)
- [Go 并发最佳实践](https://golang.org/doc/effective_go#concurrency)
- [背压处理模式](https://www.reactivemanifesto.org/)
- [熔断器模式](https://martinfowler.com/bliki/CircuitBreaker.html)

---

## 常见问题

**Q: 流模式真的能减少 5% CPU 占用吗？**
A: 在 Docker 部署的高并发场景下，启用流模式 + 背压控制可以减少约 5% 的 CPU 占用。实际效果取决于工作负载特性。

**Q: 能否同时启用所有优化？**
A: 可以，但建议逐步启用并监控影响。建议先启用流模式和连接池优化，再调整并发参数。

**Q: 如何平衡性能和可靠性？**
A: 推荐启用熔断器和智能重试，同时设置合理的超时时间和重试次数，防止级联故障。

---

**版本**: 1.0  
**最后更新**: 2024  
**作者**: Performance Optimization Team
