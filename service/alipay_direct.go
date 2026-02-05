package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/url"

	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/smartwalle/alipay/v3"
)

// GetAlipayClient 获取支付宝客户端
func GetAlipayClient() (*alipay.Client, error) {
	if !operation_setting.AlipayEnabled {
		return nil, errors.New("支付宝直连支付未启用")
	}
	
	if operation_setting.AlipayAppId == "" || operation_setting.AlipayPrivateKey == "" {
		return nil, errors.New("支付宝配置不完整")
	}

	var client *alipay.Client
	var err error
	
	if operation_setting.AlipayIsProd {
		client, err = alipay.New(operation_setting.AlipayAppId, operation_setting.AlipayPrivateKey, false)
	} else {
		client, err = alipay.New(operation_setting.AlipayAppId, operation_setting.AlipayPrivateKey, true)
	}
	
	if err != nil {
		return nil, fmt.Errorf("初始化支付宝客户端失败: %v", err)
	}

	// 加载支付宝公钥
	if operation_setting.AlipayPublicKey != "" {
		err = client.LoadAliPayPublicKey(operation_setting.AlipayPublicKey)
		if err != nil {
			return nil, fmt.Errorf("加载支付宝公钥失败: %v", err)
		}
	}

	return client, nil
}

// CreateAlipayQRCode 生成支付宝扫码支付二维码
func CreateAlipayQRCode(tradeNo string, amount float64, subject string, notifyURL string) (string, error) {
	client, err := GetAlipayClient()
	if err != nil {
		return "", err
	}

	var p = alipay.TradePreCreate{
		Trade: alipay.Trade{
			Subject:     subject,
			OutTradeNo:  tradeNo,
			TotalAmount: fmt.Sprintf("%.2f", amount),
			ProductCode: "FACE_TO_FACE_PAYMENT",
			NotifyURL:   notifyURL,
		},
	}

	rsp, err := client.TradePreCreate(context.Background(), p)
	if err != nil {
		return "", fmt.Errorf("调用支付宝API失败: %v", err)
	}

	if rsp.Code != alipay.CodeSuccess {
		return "", fmt.Errorf("支付宝返回错误: %s - %s", rsp.SubCode, rsp.SubMsg)
	}

	log.Printf("支付宝订单创建成功: %s, QRCode: %s", tradeNo, rsp.QRCode)
	return rsp.QRCode, nil
}

// VerifyAlipayNotify 验证支付宝异步通知
func VerifyAlipayNotify(params map[string]string) (bool, error) {
	client, err := GetAlipayClient()
	if err != nil {
		return false, err
	}

	// 将 map[string]string 转换为 url.Values
	values := url.Values{}
	for k, v := range params {
		values.Set(k, v)
	}

	// 验证签名
	err = client.VerifySign(values)
	if err != nil {
		return false, fmt.Errorf("支付宝签名验证失败: %v", err)
	}

	return true, nil
}

// QueryAlipayOrder 查询支付宝订单状态
func QueryAlipayOrder(tradeNo string) (string, error) {
	client, err := GetAlipayClient()
	if err != nil {
		return "", err
	}

	var p = alipay.TradeQuery{
		OutTradeNo: tradeNo,
	}

	rsp, err := client.TradeQuery(context.Background(), p)
	if err != nil {
		return "", fmt.Errorf("查询支付宝订单失败: %v", err)
	}

	if rsp.Code != alipay.CodeSuccess {
		return "", fmt.Errorf("支付宝返回错误: %s - %s", rsp.SubCode, rsp.SubMsg)
	}

	return string(rsp.TradeStatus), nil
}
