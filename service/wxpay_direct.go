package service

import (
	"context"
	"errors"
	"fmt"
	"log"

	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/wechatpay-apiv3/wechatpay-go/core"
	"github.com/wechatpay-apiv3/wechatpay-go/core/auth/verifiers"
	"github.com/wechatpay-apiv3/wechatpay-go/core/downloader"
	"github.com/wechatpay-apiv3/wechatpay-go/core/notify"
	"github.com/wechatpay-apiv3/wechatpay-go/core/option"
	"github.com/wechatpay-apiv3/wechatpay-go/services/payments/native"
	"github.com/wechatpay-apiv3/wechatpay-go/utils"
)

// GetWxpayClient 获取微信支付客户端
func GetWxpayClient() (*core.Client, error) {
	if !operation_setting.WxpayEnabled {
		return nil, errors.New("微信支付直连未启用")
	}

	if operation_setting.WxpayMchId == "" || operation_setting.WxpayApiV3Key == "" || 
	   operation_setting.WxpayCertSerial == "" || operation_setting.WxpayPrivateKey == "" {
		return nil, errors.New("微信支付配置不完整")
	}

	// 使用商户私钥等初始化 client
	mchPrivateKey, err := utils.LoadPrivateKeyWithPath(operation_setting.WxpayPrivateKey)
	if err != nil {
		// 尝试直接从字符串加载
		mchPrivateKey, err = utils.LoadPrivateKey(operation_setting.WxpayPrivateKey)
		if err != nil {
			return nil, fmt.Errorf("加载商户私钥失败: %v", err)
		}
	}

	ctx := context.Background()
	
	// 使用商户私钥等初始化 client，并使它具有自动定时获取微信支付平台证书的能力
	opts := []core.ClientOption{
		option.WithWechatPayAutoAuthCipher(
			operation_setting.WxpayMchId,
			operation_setting.WxpayCertSerial,
			mchPrivateKey,
			operation_setting.WxpayApiV3Key,
		),
	}
	
	client, err := core.NewClient(ctx, opts...)
	if err != nil {
		return nil, fmt.Errorf("初始化微信支付客户端失败: %v", err)
	}

	return client, nil
}

// CreateWxpayQRCode 生成微信Native支付二维码
func CreateWxpayQRCode(tradeNo string, amount int64, description string, notifyURL string) (string, error) {
	client, err := GetWxpayClient()
	if err != nil {
		return "", err
	}

	svc := native.NativeApiService{Client: client}

	resp, _, err := svc.Prepay(context.Background(),
		native.PrepayRequest{
			Appid:       core.String(operation_setting.WxpayAppId),
			Mchid:       core.String(operation_setting.WxpayMchId),
			Description: core.String(description),
			OutTradeNo:  core.String(tradeNo),
			NotifyUrl:   core.String(notifyURL),
			Amount: &native.Amount{
				Total: core.Int64(amount), // 单位：分
			},
			TimeExpire: nil, // 可选：订单失效时间
		},
	)

	if err != nil {
		return "", fmt.Errorf("调用微信支付API失败: %v", err)
	}

	if resp.CodeUrl == nil {
		return "", errors.New("微信支付返回的二维码为空")
	}

	log.Printf("微信支付订单创建成功: %s, CodeUrl: %s", tradeNo, *resp.CodeUrl)
	return *resp.CodeUrl, nil
}

// GetWxpayNotifyHandler 获取微信支付异步通知处理器
func GetWxpayNotifyHandler() (*notify.Handler, error) {
	if !operation_setting.WxpayEnabled {
		return nil, errors.New("微信支付直连未启用")
	}

	mchPrivateKey, err := utils.LoadPrivateKeyWithPath(operation_setting.WxpayPrivateKey)
	if err != nil {
		mchPrivateKey, err = utils.LoadPrivateKey(operation_setting.WxpayPrivateKey)
		if err != nil {
			return nil, fmt.Errorf("加载商户私钥失败: %v", err)
		}
	}

	ctx := context.Background()
	
	// 1. 使用 `RegisterDownloaderWithPrivateKey` 注册下载器
	err = downloader.MgrInstance().RegisterDownloaderWithPrivateKey(
		ctx,
		mchPrivateKey,
		operation_setting.WxpayCertSerial,
		operation_setting.WxpayMchId,
		operation_setting.WxpayApiV3Key,
	)
	if err != nil {
		return nil, fmt.Errorf("注册微信支付证书下载器失败: %v", err)
	}

	// 2. 获取商户号对应的微信支付平台证书访问器
	certificateVisitor := downloader.MgrInstance().GetCertificateVisitor(operation_setting.WxpayMchId)

	// 3. 使用证书访问器初始化 `notify.Handler`
	handler := notify.NewNotifyHandler(
		operation_setting.WxpayApiV3Key,
		verifiers.NewSHA256WithRSAVerifier(certificateVisitor),
	)

	return handler, nil
}

// QueryWxpayOrder 查询微信支付订单
func QueryWxpayOrder(tradeNo string) (string, error) {
	client, err := GetWxpayClient()
	if err != nil {
		return "", err
	}

	svc := native.NativeApiService{Client: client}
	
	resp, _, err := svc.QueryOrderByOutTradeNo(context.Background(),
		native.QueryOrderByOutTradeNoRequest{
			OutTradeNo: core.String(tradeNo),
			Mchid:      core.String(operation_setting.WxpayMchId),
		},
	)

	if err != nil {
		return "", fmt.Errorf("查询微信支付订单失败: %v", err)
	}

	if resp.TradeState == nil {
		return "", errors.New("微信支付返回的订单状态为空")
	}

	return string(*resp.TradeState), nil
}
