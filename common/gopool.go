package common

import (
	"context"
	"fmt"
	"math"
	"runtime"
	"sync"
	"sync/atomic"
	"time"

	"github.com/bytedance/gopkg/util/gopool"
)

var (
	relayGoPool            gopool.Pool
	goroutinePoolSizeLock  sync.RWMutex
	currentGoroutineCount  int64
	peakGoroutineCount     int64
	lastAlarmTime          time.Time
	lastStatsPrintTime     time.Time
	enableGoroutineAlarm   bool = true
	maxGoroutinePerRequest int  = 100
	goroutineAlarmInterval       = 1 * time.Minute // 告警间隔，防止日志过多
)

func init() {
	// 从性能设置中读取配置（动态初始化）
	poolSize := getGoroutinePoolSize()
	relayGoPool = gopool.NewPool("gopool.RelayPool", poolSize, gopool.NewConfig())
	relayGoPool.SetPanicHandler(func(ctx context.Context, i interface{}) {
		atomic.AddInt64(&currentGoroutineCount, -1)
		if stopChan, ok := ctx.Value("stop_chan").(chan bool); ok {
			SafeSendBool(stopChan, true)
		}
		SysError(fmt.Sprintf("panic in gopool.RelayPool: %v", i))
	})

	// 启动 goroutine 监控（如果启用）
	if DebugEnabled {
		go monitorGoroutines()
	}
}

// getGoroutinePoolSize 获取 goroutine 池大小
func getGoroutinePoolSize() int {
	// 首先尝试从性能设置中读取
	// 由于初始化顺序问题，这里设置一个合理的默认值
	numCPU := runtime.NumCPU()
	// 通常每个 CPU 核心分配 100-200 个 goroutine
	defaultPoolSize := numCPU * 128
	if defaultPoolSize > math.MaxInt32 {
		return math.MaxInt32
	}
	return defaultPoolSize
}

// SetMaxGoroutinePerRequest 设置每个请求最多创建的 goroutine 数
func SetMaxGoroutinePerRequest(max int) {
	if max > 0 {
		maxGoroutinePerRequest = max
	}
}

// UpdateGoroutinePoolConfig 更新 goroutine 池配置
func UpdateGoroutinePoolConfig(enableAlarm bool, maxPerRequest int) {
	enableGoroutineAlarm = enableAlarm
	if maxPerRequest > 0 {
		maxGoroutinePerRequest = maxPerRequest
	}
}

// RelayCtxGo 在 relay goroutine 池中执行函数
func RelayCtxGo(ctx context.Context, f func()) {
	current := atomic.AddInt64(&currentGoroutineCount, 1)
	
	// 更新峰值
	for {
		peak := atomic.LoadInt64(&peakGoroutineCount)
		if current <= peak || atomic.CompareAndSwapInt64(&peakGoroutineCount, peak, current) {
			break
		}
	}

	// 检查是否超过警告阈值
	if enableGoroutineAlarm && current > int64(maxGoroutinePerRequest)*10 {
		now := time.Now()
		if now.Sub(lastAlarmTime) > goroutineAlarmInterval {
			SysLog(fmt.Sprintf("⚠️ High goroutine count: current=%d, peak=%d, threshold=%d",
				current, atomic.LoadInt64(&peakGoroutineCount), maxGoroutinePerRequest*10))
			lastAlarmTime = now
		}
	}

	// 包装函数以在完成后递减计数
	wrappedFunc := func() {
		defer func() {
			atomic.AddInt64(&currentGoroutineCount, -1)
			if r := recover(); r != nil {
				SysError(fmt.Sprintf("panic in relay goroutine: %v", r))
			}
		}()
		f()
	}

	relayGoPool.CtxGo(ctx, wrappedFunc)
}

// GetGoroutineStats 获取 goroutine 统计信息
func GetGoroutineStats() map[string]int64 {
	return map[string]int64{
		"current": atomic.LoadInt64(&currentGoroutineCount),
		"peak":    atomic.LoadInt64(&peakGoroutineCount),
	}
}

// ResetGoroutineStats 重置 goroutine 统计信息
func ResetGoroutineStats() {
	atomic.StoreInt64(&currentGoroutineCount, 0)
	atomic.StoreInt64(&peakGoroutineCount, 0)
}

// monitorGoroutines 定期监控 goroutine 统计信息
func monitorGoroutines() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now()
		current := atomic.LoadInt64(&currentGoroutineCount)
		peak := atomic.LoadInt64(&peakGoroutineCount)
		
		// 每 5 分钟打印一次统计信息
		if now.Sub(lastStatsPrintTime) > 5*time.Minute {
			SysLog(fmt.Sprintf("📊 Goroutine stats - Current: %d, Peak: %d, Runtime Goroutines: %d",
				current, peak, runtime.NumGoroutine()))
			lastStatsPrintTime = now
		}
	}
}
