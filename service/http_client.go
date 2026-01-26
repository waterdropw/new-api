package service

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"golang.org/x/net/proxy"
)

var (
	httpClient         *http.Client
	proxyClientLock    sync.Mutex
	proxyClients       = make(map[string]*http.Client)
	httpClientLock     sync.RWMutex // 保护 httpClient 的读写
	lastUpdateTime     time.Time    // 上次更新连接池配置的时间
	updateCheckInterval = 5 * time.Minute // 检查配置更新的间隔
)

func checkRedirect(req *http.Request, via []*http.Request) error {
	fetchSetting := system_setting.GetFetchSetting()
	urlStr := req.URL.String()
	if err := common.ValidateURLWithFetchSetting(urlStr, fetchSetting.EnableSSRFProtection, fetchSetting.AllowPrivateIp, fetchSetting.DomainFilterMode, fetchSetting.IpFilterMode, fetchSetting.DomainList, fetchSetting.IpList, fetchSetting.AllowedPorts, fetchSetting.ApplyIPFilterForDomain); err != nil {
		return fmt.Errorf("redirect to %s blocked: %v", urlStr, err)
	}
	if len(via) >= 10 {
		return fmt.Errorf("stopped after 10 redirects")
	}
	return nil
}

func InitHttpClient() {
	httpClientLock.Lock()
	defer httpClientLock.Unlock()
	
	transport := createHttpTransport()
	lastUpdateTime = time.Now()

	if common.RelayTimeout == 0 {
		httpClient = &http.Client{
			Transport:     transport,
			CheckRedirect: checkRedirect,
		}
	} else {
		httpClient = &http.Client{
			Transport:     transport,
			Timeout:       time.Duration(common.RelayTimeout) * time.Second,
			CheckRedirect: checkRedirect,
		}
	}
}

// createHttpTransport 创建 HTTP Transport，应用性能设置
func createHttpTransport() *http.Transport {
	perfSetting := operation_setting.GetPerformanceSetting()
	
	maxIdleConns := common.RelayMaxIdleConns
	maxIdleConnsPerHost := common.RelayMaxIdleConnsPerHost
	
	// 如果启用了连接池优化，使用性能设置中的参数
	if perfSetting.EnableConnectionPoolOptimization {
		if perfSetting.MaxIdleConns > 0 {
			maxIdleConns = perfSetting.MaxIdleConns
		}
		if perfSetting.MaxIdleConnsPerHost > 0 {
			maxIdleConnsPerHost = perfSetting.MaxIdleConnsPerHost
		}
	}

	transport := &http.Transport{
		MaxIdleConns:          maxIdleConns,
		MaxIdleConnsPerHost:   maxIdleConnsPerHost,
		MaxConnsPerHost:       0, // 无限制
		IdleConnTimeout:       time.Duration(perfSetting.IdleConnTimeout) * time.Second,
		ForceAttemptHTTP2:     true,
		Proxy:                 http.ProxyFromEnvironment,
		DisableKeepAlives:     false,
		DisableCompression:    false,
		TLSHandshakeTimeout:   10 * time.Second,
		ResponseHeaderTimeout: 0,
	}
	
	return transport
}

// UpdateHttpClientIfNeeded 检查并更新 HTTP 客户端配置（如果配置发生变化）
func UpdateHttpClientIfNeeded() {
	// 检查是否需要更新
	now := time.Now()
	if now.Sub(lastUpdateTime) < updateCheckInterval {
		return
	}
	
	httpClientLock.Lock()
	defer httpClientLock.Unlock()
	
	// 再次检查以避免并发问题
	if time.Now().Sub(lastUpdateTime) < updateCheckInterval {
		return
	}
	
	oldTransport := httpClient.Transport.(*http.Transport)
	newTransport := createHttpTransport()
	
	// 如果配置有变化，更新客户端
	if oldTransport.MaxIdleConns != newTransport.MaxIdleConns ||
		oldTransport.MaxIdleConnsPerHost != newTransport.MaxIdleConnsPerHost {
		
		oldTransport.CloseIdleConnections()
		httpClient.Transport = newTransport
		common.SysLog("HTTP client connection pool updated")
	}
	
	lastUpdateTime = now
}

func GetHttpClient() *http.Client {
	httpClientLock.RLock()
	defer httpClientLock.RUnlock()
	
	// 检查是否需要更新配置
	if time.Now().Sub(lastUpdateTime) >= updateCheckInterval {
		// 在后台更新（不阻塞当前请求）
		go UpdateHttpClientIfNeeded()
	}
	
	return httpClient
}

// GetHttpClientWithProxy returns the default client or a proxy-enabled one when proxyURL is provided.
func GetHttpClientWithProxy(proxyURL string) (*http.Client, error) {
	if proxyURL == "" {
		return GetHttpClient(), nil
	}
	return NewProxyHttpClient(proxyURL)
}

// ResetProxyClientCache 清空代理客户端缓存，确保下次使用时重新初始化
func ResetProxyClientCache() {
	proxyClientLock.Lock()
	defer proxyClientLock.Unlock()
	for _, client := range proxyClients {
		if transport, ok := client.Transport.(*http.Transport); ok && transport != nil {
			transport.CloseIdleConnections()
		}
	}
	proxyClients = make(map[string]*http.Client)
}

// NewProxyHttpClient 创建支持代理的 HTTP 客户端
func NewProxyHttpClient(proxyURL string) (*http.Client, error) {
	if proxyURL == "" {
		if client := GetHttpClient(); client != nil {
			return client, nil
		}
		return http.DefaultClient, nil
	}

	proxyClientLock.Lock()
	if client, ok := proxyClients[proxyURL]; ok {
		proxyClientLock.Unlock()
		return client, nil
	}
	proxyClientLock.Unlock()

	parsedURL, err := url.Parse(proxyURL)
	if err != nil {
		return nil, err
	}

	switch parsedURL.Scheme {
	case "http", "https":
		client := &http.Client{
			Transport: &http.Transport{
				MaxIdleConns:        common.RelayMaxIdleConns,
				MaxIdleConnsPerHost: common.RelayMaxIdleConnsPerHost,
				ForceAttemptHTTP2:   true,
				Proxy:               http.ProxyURL(parsedURL),
			},
			CheckRedirect: checkRedirect,
		}
		client.Timeout = time.Duration(common.RelayTimeout) * time.Second
		proxyClientLock.Lock()
		proxyClients[proxyURL] = client
		proxyClientLock.Unlock()
		return client, nil

	case "socks5", "socks5h":
		// 获取认证信息
		var auth *proxy.Auth
		if parsedURL.User != nil {
			auth = &proxy.Auth{
				User:     parsedURL.User.Username(),
				Password: "",
			}
			if password, ok := parsedURL.User.Password(); ok {
				auth.Password = password
			}
		}

		// 创建 SOCKS5 代理拨号器
		// proxy.SOCKS5 使用 tcp 参数，所有 TCP 连接包括 DNS 查询都将通过代理进行。行为与 socks5h 相同
		dialer, err := proxy.SOCKS5("tcp", parsedURL.Host, auth, proxy.Direct)
		if err != nil {
			return nil, err
		}

		client := &http.Client{
			Transport: &http.Transport{
				MaxIdleConns:        common.RelayMaxIdleConns,
				MaxIdleConnsPerHost: common.RelayMaxIdleConnsPerHost,
				ForceAttemptHTTP2:   true,
				DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
					return dialer.Dial(network, addr)
				},
			},
			CheckRedirect: checkRedirect,
		}
		client.Timeout = time.Duration(common.RelayTimeout) * time.Second
		proxyClientLock.Lock()
		proxyClients[proxyURL] = client
		proxyClientLock.Unlock()
		return client, nil

	default:
		return nil, fmt.Errorf("unsupported proxy scheme: %s, must be http, https, socks5 or socks5h", parsedURL.Scheme)
	}
}
