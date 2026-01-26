package controller

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/console_setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
)

func GetOptions(c *gin.Context) {
	var options []*model.Option
	common.OptionMapRWMutex.Lock()
	for k, v := range common.OptionMap {
		if strings.HasSuffix(k, "Token") ||
			strings.HasSuffix(k, "Secret") ||
			strings.HasSuffix(k, "Key") ||
			strings.HasSuffix(k, "secret") ||
			strings.HasSuffix(k, "api_key") {
			continue
		}
		options = append(options, &model.Option{
			Key:   k,
			Value: common.Interface2String(v),
		})
	}
	common.OptionMapRWMutex.Unlock()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    options,
	})
	return
}

type OptionUpdateRequest struct {
	Key   string `json:"key"`
	Value any    `json:"value"`
}

func UpdateOption(c *gin.Context) {
	var option OptionUpdateRequest
	err := json.NewDecoder(c.Request.Body).Decode(&option)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}
	switch option.Value.(type) {
	case bool:
		option.Value = common.Interface2String(option.Value.(bool))
	case float64:
		option.Value = common.Interface2String(option.Value.(float64))
	case int:
		option.Value = common.Interface2String(option.Value.(int))
	default:
		option.Value = fmt.Sprintf("%v", option.Value)
	}
	switch option.Key {
	case "GitHubOAuthEnabled":
		if option.Value == "true" && common.GitHubClientId == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 GitHub OAuth，请先填入 GitHub Client Id 以及 GitHub Client Secret！",
			})
			return
		}
	case "discord.enabled":
		if option.Value == "true" && system_setting.GetDiscordSettings().ClientId == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 Discord OAuth，请先填入 Discord Client Id 以及 Discord Client Secret！",
			})
			return
		}
	case "oidc.enabled":
		if option.Value == "true" && system_setting.GetOIDCSettings().ClientId == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 OIDC 登录，请先填入 OIDC Client Id 以及 OIDC Client Secret！",
			})
			return
		}
	case "LinuxDOOAuthEnabled":
		if option.Value == "true" && common.LinuxDOClientId == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 LinuxDO OAuth，请先填入 LinuxDO Client Id 以及 LinuxDO Client Secret！",
			})
			return
		}
	case "EmailDomainRestrictionEnabled":
		if option.Value == "true" && len(common.EmailDomainWhitelist) == 0 {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用邮箱域名限制，请先填入限制的邮箱域名！",
			})
			return
		}
	case "WeChatAuthEnabled":
		if option.Value == "true" && common.WeChatServerAddress == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用微信登录，请先填入微信登录相关配置信息！",
			})
			return
		}
	case "TurnstileCheckEnabled":
		if option.Value == "true" && common.TurnstileSiteKey == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 Turnstile 校验，请先填入 Turnstile 校验相关配置信息！",
			})

			return
		}
	case "TelegramOAuthEnabled":
		if option.Value == "true" && common.TelegramBotToken == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 Telegram OAuth，请先填入 Telegram Bot Token！",
			})
			return
		}
	case "GroupRatio":
		err = ratio_setting.CheckGroupRatio(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "ImageRatio":
		err = ratio_setting.UpdateImageRatioByJSONString(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "图片倍率设置失败: " + err.Error(),
			})
			return
		}
	case "AudioRatio":
		err = ratio_setting.UpdateAudioRatioByJSONString(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "音频倍率设置失败: " + err.Error(),
			})
			return
		}
	case "AudioCompletionRatio":
		err = ratio_setting.UpdateAudioCompletionRatioByJSONString(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "音频补全倍率设置失败: " + err.Error(),
			})
			return
		}
	case "ModelRequestRateLimitGroup":
		err = setting.CheckModelRequestRateLimitGroup(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "console_setting.api_info":
		err = console_setting.ValidateConsoleSettings(option.Value.(string), "ApiInfo")
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "console_setting.announcements":
		err = console_setting.ValidateConsoleSettings(option.Value.(string), "Announcements")
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "console_setting.faq":
		err = console_setting.ValidateConsoleSettings(option.Value.(string), "FAQ")
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "console_setting.uptime_kuma_groups":
		err = console_setting.ValidateConsoleSettings(option.Value.(string), "UptimeKumaGroups")
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	}
	err = model.UpdateOption(option.Key, option.Value.(string))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

// GetPerformanceSetting 获取性能设置
func GetPerformanceSetting(c *gin.Context) {
	perfSetting := operation_setting.GetPerformanceSetting()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    perfSetting,
	})
}

// UpdatePerformanceSetting 更新性能设置
func UpdatePerformanceSetting(c *gin.Context) {
	var perfSetting operation_setting.PerformanceSetting
	if err := c.BindJSON(&perfSetting); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "invalid request: " + err.Error(),
		})
		return
	}

	// 更新性能设置
	currentSetting := operation_setting.GetPerformanceSetting()
	*currentSetting = perfSetting

	// 应用配置到系统
	if perfSetting.EnableGoroutineAlarm {
		common.UpdateGoroutinePoolConfig(
			perfSetting.EnableGoroutineAlarm,
			perfSetting.MaxGoroutinePerRequest,
		)
	}

	// 如果启用了内存优化，可以在这里应用相关配置
	if perfSetting.EnableMemoryOptimization {
		common.SysLog("Memory optimization enabled")
	}

	// 持久化到数据库
	settingJson, err := json.Marshal(perfSetting)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "failed to marshal setting: " + err.Error(),
		})
		return
	}

	err = model.UpdateOption("performance_setting", string(settingJson))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "failed to update setting: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "performance setting updated successfully",
	})
}

// GetRetrySetting 获取重试设置
func GetRetrySetting(c *gin.Context) {
	retrySetting := operation_setting.GetRetrySetting()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    retrySetting,
	})
}

// UpdateRetrySetting 更新重试设置
func UpdateRetrySetting(c *gin.Context) {
	var retrySetting operation_setting.RetrySetting
	if err := c.BindJSON(&retrySetting); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "invalid request: " + err.Error(),
		})
		return
	}

	// 验证设置的合理性
	if retrySetting.MaxRetryAttempts < 0 || retrySetting.MaxRetryAttempts > 10 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "max_retry_attempts must be between 0 and 10",
		})
		return
	}

	if retrySetting.BaseRetryDelayMs < 0 || retrySetting.MaxRetryDelayMs < 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "retry delay must be non-negative",
		})
		return
	}

	// 更新重试设置
	currentSetting := operation_setting.GetRetrySetting()
	*currentSetting = retrySetting

	// 持久化到数据库
	settingJson, err := json.Marshal(retrySetting)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "failed to marshal setting: " + err.Error(),
		})
		return
	}

	err = model.UpdateOption("retry_setting", string(settingJson))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "failed to update setting: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "retry setting updated successfully",
	})
}
