package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// RetryStrategy 重试策略枚举
const (
	RetryStrategyFixed    = "fixed"      // 固定延迟
	RetryStrategyLinear   = "linear"     // 线性退避
	RetryStrategyExponent = "exponent"   // 指数退避
)

// RetrySetting 高并发高重试场景下的重试配置
type RetrySetting struct {
	// 重试基础配置
	MaxRetryAttempts       int    `json:"max_retry_attempts"`      // 最大重试次数
	RetryStrategy          string `json:"retry_strategy"`          // 重试策略：fixed/linear/exponent
	BaseRetryDelayMs       int    `json:"base_retry_delay_ms"`     // 基础重试延迟（毫秒）
	MaxRetryDelayMs        int    `json:"max_retry_delay_ms"`      // 最大重试延迟（毫秒）
	
	// 重试条件
	RetryOnTimeout         bool   `json:"retry_on_timeout"`        // 超时时重试
	RetryOn5xx             bool   `json:"retry_on_5xx"`            // 5xx 错误时重试
	RetryOn429             bool   `json:"retry_on_429"`            // 速率限制 (429) 时重试
	RetryOnConnectionError bool   `json:"retry_on_connection_error"` // 连接错误时重试

	// 性能相关
	EnableRetryQueue       bool   `json:"enable_retry_queue"`      // 启用重试队列管理
	MaxRetryQueueSize      int    `json:"max_retry_queue_size"`    // 最大重试队列大小
	RetryTimeoutSeconds    int    `json:"retry_timeout_seconds"`   // 单次重试超时时间（秒）
	
	// 熔断器
	CircuitBreakerEnabled  bool   `json:"circuit_breaker_enabled"` // 启用熔断器
	CircuitBreakerThreshold int   `json:"circuit_breaker_threshold"` // 熔断器阈值（连续失败次数）
	CircuitBreakerResetSeconds int `json:"circuit_breaker_reset_seconds"` // 熔断器重置时间（秒）
}

// 默认配置
var retrySetting = RetrySetting{
	// 重试基础配置
	MaxRetryAttempts:       3,              // 最多重试 3 次
	RetryStrategy:          RetryStrategyExponent, // 使用指数退避
	BaseRetryDelayMs:       100,            // 基础延迟 100ms
	MaxRetryDelayMs:        30000,          // 最大延迟 30s

	// 重试条件 - 默认启用常见的重试场景
	RetryOnTimeout:         true,
	RetryOn5xx:             true,
	RetryOn429:             true,
	RetryOnConnectionError: true,

	// 性能相关
	EnableRetryQueue:       true,
	MaxRetryQueueSize:      10000,
	RetryTimeoutSeconds:    30,

	// 熔断器 - 在高并发场景下防止级联故障
	CircuitBreakerEnabled:  true,
	CircuitBreakerThreshold: 10,          // 连续失败 10 次后熔断
	CircuitBreakerResetSeconds: 60,       // 60 秒后尝试恢复
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("retry_setting", &retrySetting)
}

// GetRetrySetting 获取重试设置
func GetRetrySetting() *RetrySetting {
	return &retrySetting
}

// CalculateRetryDelay 计算重试延迟（毫秒）
func (r *RetrySetting) CalculateRetryDelay(attemptNumber int) int {
	if attemptNumber <= 0 {
		return 0
	}

	var delay int
	switch r.RetryStrategy {
	case RetryStrategyFixed:
		// 固定延迟
		delay = r.BaseRetryDelayMs
	case RetryStrategyLinear:
		// 线性退避：delay = base * attemptNumber
		delay = r.BaseRetryDelayMs * attemptNumber
	case RetryStrategyExponent:
		// 指数退避：delay = base * (2 ^ attemptNumber)
		delay = r.BaseRetryDelayMs
		for i := 0; i < attemptNumber-1; i++ {
			delay *= 2
		}
	default:
		delay = r.BaseRetryDelayMs
	}

	// 限制最大延迟
	if delay > r.MaxRetryDelayMs {
		delay = r.MaxRetryDelayMs
	}

	return delay
}

// ShouldRetry 判断是否应该重试
func (r *RetrySetting) ShouldRetry(statusCode int, err error, attemptCount int) bool {
	if attemptCount >= r.MaxRetryAttempts {
		return false
	}

	if err != nil {
		// 连接错误
		if r.RetryOnConnectionError {
			return true
		}
	}

	// HTTP 状态码检查
	switch statusCode {
	case 429: // Too Many Requests
		return r.RetryOn429
	case 500, 502, 503, 504: // Server errors
		return r.RetryOn5xx
	case 408: // Request Timeout
		return r.RetryOnTimeout
	}

	return false
}

// IsCircuitBreakerOpen 判断熔断器是否打开
func (r *RetrySetting) IsCircuitBreakerOpen(consecutiveFailures int) bool {
	if !r.CircuitBreakerEnabled {
		return false
	}
	return consecutiveFailures >= r.CircuitBreakerThreshold
}
