package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// PerformanceSetting 系统性能设置
type PerformanceSetting struct {
	// 流模式优化
	StreamModeEnabled        bool `json:"stream_mode_enabled"`        // 启用流模式优化，可减少约 5% CPU
	StreamBufferSizeKB       int  `json:"stream_buffer_size_kb"`      // 流缓冲区大小 (KB)，默认 64
	StreamChunkSizeBytes     int  `json:"stream_chunk_size_bytes"`    // 单次读取字节数，默认 4096
	EnableStreamBackPressure bool `json:"enable_stream_back_pressure"` // 启用流背压控制

	// 并发控制
	MaxConcurrentRequests      int `json:"max_concurrent_requests"`      // 最大并发请求数，0 表示无限制
	MaxGoroutinePerRequest     int `json:"max_goroutine_per_request"`    // 每个请求最多创建的 goroutine 数
	GoroutinePoolSize          int `json:"goroutine_pool_size"`          // 全局 goroutine 池大小
	EnableGoroutineAlarm       bool `json:"enable_goroutine_alarm"`      // 启用 goroutine 告警

	// 内存管理
	EnableMemoryOptimization   bool    `json:"enable_memory_optimization"`    // 启用内存优化
	MaxMemoryUsagePercent      float64 `json:"max_memory_usage_percent"`      // 最大内存使用百分比 (0-100)，0 表示不限制
	MemoryAlarmThresholdPercent float64 `json:"memory_alarm_threshold_percent"` // 内存告警阈值百分比

	// HTTP 连接池优化
	EnableConnectionPoolOptimization bool `json:"enable_connection_pool_optimization"` // 启用连接池优化
	MaxIdleConns                     int  `json:"max_idle_conns"`                     // 最大空闲连接数
	MaxIdleConnsPerHost              int  `json:"max_idle_conns_per_host"`            // 每个 host 最大空闲连接数
	IdleConnTimeout                  int  `json:"idle_conn_timeout_seconds"`          // 空闲连接超时时间（秒）

	// 缓存策略
	EnableResponseCache bool `json:"enable_response_cache"` // 启用响应缓存
	CacheTTLSeconds     int  `json:"cache_ttl_seconds"`     // 缓存过期时间（秒）

	// CPU 优化
	EnableCPUOptimization bool `json:"enable_cpu_optimization"` // 启用 CPU 优化（减少不必要的锁竞争）
	ReduceMutexContention bool `json:"reduce_mutex_contention"` // 减少 mutex 竞争
}

// 默认配置
var performanceSetting = PerformanceSetting{
	// 流模式优化 - Docker 部署下启用可减少约 5% CPU
	StreamModeEnabled:        true,
	StreamBufferSizeKB:       64,
	StreamChunkSizeBytes:     4096,
	EnableStreamBackPressure: true,

	// 并发控制
	MaxConcurrentRequests:    0,   // 无限制
	MaxGoroutinePerRequest:   100, // 默认 100
	GoroutinePoolSize:        2147483647, // math.MaxInt32
	EnableGoroutineAlarm:     true,

	// 内存管理
	EnableMemoryOptimization:    true,
	MaxMemoryUsagePercent:       0,   // 不限制
	MemoryAlarmThresholdPercent: 85,  // 85% 时告警

	// HTTP 连接池优化
	EnableConnectionPoolOptimization: true,
	MaxIdleConns:                     500,
	MaxIdleConnsPerHost:              100,
	IdleConnTimeout:                  90,

	// 缓存策略
	EnableResponseCache: false,
	CacheTTLSeconds:     300,

	// CPU 优化
	EnableCPUOptimization:  true,
	ReduceMutexContention:  true,
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("performance_setting", &performanceSetting)
}

// GetPerformanceSetting 获取性能设置
func GetPerformanceSetting() *PerformanceSetting {
	return &performanceSetting
}

// IsStreamModeOptimized 是否启用了流模式优化
func IsStreamModeOptimized() bool {
	return performanceSetting.StreamModeEnabled
}

// GetStreamBufferSize 获取流缓冲区大小（字节）
func GetStreamBufferSize() int {
	if performanceSetting.StreamBufferSizeKB <= 0 {
		return 64 << 10 // 默认 64KB
	}
	return performanceSetting.StreamBufferSizeKB << 10
}

// GetStreamChunkSize 获取单次读取字节数
func GetStreamChunkSize() int {
	if performanceSetting.StreamChunkSizeBytes <= 0 {
		return 4096
	}
	return performanceSetting.StreamChunkSizeBytes
}

// ShouldApplyBackPressure 是否应用背压控制
func ShouldApplyBackPressure() bool {
	return performanceSetting.StreamModeEnabled && performanceSetting.EnableStreamBackPressure
}

// GetMaxConcurrentRequests 获取最大并发请求数
func GetMaxConcurrentRequests() int {
	return performanceSetting.MaxConcurrentRequests
}

// ShouldOptimizeMemory 是否应用内存优化
func ShouldOptimizeMemory() bool {
	return performanceSetting.EnableMemoryOptimization
}
